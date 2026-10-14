import { percentile } from "../shared/stats";

export type DiagnosticKind = "preview" | "acquired" | "processed" | "rendered";

export type DiagnosticSample = {
  timestampMs: number;
  previewFps: number;
  acquiredFps: number;
  processedFps: number;
  uiFps: number;
  frameAgeMsP50: number;
  frameAgeMsP95: number;
  droppedFrames: number;
  workerProcessingMsP95: number;
  memoryBytes: number | null;
  batteryLevel: number | null;
  thermalSignal: "none" | "rate-drop" | "os-warning";
};

type TimedFrame = { timestampMs: number; frameId?: number };
type TimedValue = { timestampMs: number; value: number };

/**
 * Tracks camera pipeline rates and latencies over a sliding window. Every statistic, including
 * percentiles, covers only the last `windowMs`, so adaptive controls react to current load.
 * Timestamps are `performance.now()` values from the main thread.
 */
export class FrameDiagnostics {
  private records: Record<DiagnosticKind, TimedFrame[]> = { preview: [], acquired: [], processed: [], rendered: [] };
  private acquiredAt = new Map<number, number>();
  private frameAges: TimedValue[] = [];
  private processingTimes: TimedValue[] = [];
  private droppedFrames = 0;
  private targetFps = 10;
  private batteryLevel: number | null = null;
  private osThermalWarning = false;

  constructor(private readonly windowMs = 1000) {}

  record(kind: DiagnosticKind, timestampMs: number, frameId?: number): void {
    this.records[kind].push({ timestampMs, frameId });
    if (kind === "acquired" && frameId !== undefined) this.acquiredAt.set(frameId, timestampMs);
    if ((kind === "processed" || kind === "rendered") && frameId !== undefined) {
      const acquiredAt = this.acquiredAt.get(frameId);
      if (acquiredAt === undefined) return;
      const sample = { timestampMs, value: Math.max(0, timestampMs - acquiredAt) };
      if (kind === "processed") this.processingTimes.push(sample);
      else {
        this.frameAges.push(sample);
        this.acquiredAt.delete(frameId);
      }
    }
  }

  /** Counts a frame that was captured but refused because the worker was still busy. */
  recordDropped(count = 1): void {
    this.droppedFrames += count;
  }

  setTargetFps(fps: number): void {
    this.targetFps = fps;
  }

  snapshot(timestampMs = performance.now()): DiagnosticSample {
    this.trim(timestampMs);
    const processedFps = this.records.processed.length * (1000 / this.windowMs);
    const frameAges = this.frameAges.map((sample) => sample.value);
    return {
      timestampMs,
      previewFps: this.records.preview.length * (1000 / this.windowMs),
      acquiredFps: this.records.acquired.length * (1000 / this.windowMs),
      processedFps,
      uiFps: this.records.rendered.length * (1000 / this.windowMs),
      frameAgeMsP50: percentile(frameAges, 0.5),
      frameAgeMsP95: percentile(frameAges, 0.95),
      droppedFrames: this.droppedFrames,
      workerProcessingMsP95: percentile(
        this.processingTimes.map((sample) => sample.value),
        0.95,
      ),
      memoryBytes: readMemoryBytes(),
      batteryLevel: this.batteryLevel,
      thermalSignal: this.osThermalWarning
        ? "os-warning"
        : processedFps > 0 && processedFps < this.targetFps * 0.8
          ? "rate-drop"
          : "none",
    };
  }

  setBatteryLevel(level: number | null): void {
    this.batteryLevel = level;
  }

  setOsThermalWarning(active: boolean): void {
    this.osThermalWarning = active;
  }

  reset(): void {
    this.records = { preview: [], acquired: [], processed: [], rendered: [] };
    this.acquiredAt.clear();
    this.frameAges = [];
    this.processingTimes = [];
    this.droppedFrames = 0;
  }

  private trim(now: number): void {
    const cutoff = now - this.windowMs;
    const inWindow = (record: { timestampMs: number }) => record.timestampMs >= cutoff && record.timestampMs <= now;
    for (const kind of Object.keys(this.records) as DiagnosticKind[])
      this.records[kind] = this.records[kind].filter(inWindow);
    this.frameAges = this.frameAges.filter(inWindow);
    this.processingTimes = this.processingTimes.filter(inWindow);
    for (const [frameId, acquiredAt] of this.acquiredAt)
      if (acquiredAt < cutoff - 5_000) this.acquiredAt.delete(frameId);
  }
}

function readMemoryBytes(): number | null {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    }
  ).memory;
  return typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null;
}
