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

export class FrameDiagnostics {
  private records: Record<DiagnosticKind, TimedFrame[]> = {
    preview: [],
    acquired: [],
    processed: [],
    rendered: [],
  };
  private acquiredAt = new Map<number, number>();
  private frameAges: number[] = [];
  private processingTimes: number[] = [];
  private lastAcquiredFrameId: number | null = null;
  private droppedFrames = 0;
  private batteryLevel: number | null = null;
  private osThermalWarning = false;

  constructor(private readonly windowMs = 1000) {}

  record(kind: DiagnosticKind, timestampMs: number, frameId?: number): void {
    this.records[kind].push({ timestampMs, frameId });

    if (kind === "acquired" && frameId !== undefined) {
      if (this.lastAcquiredFrameId !== null && frameId > this.lastAcquiredFrameId + 1) {
        this.droppedFrames += frameId - this.lastAcquiredFrameId - 1;
      }
      this.lastAcquiredFrameId = frameId;
      this.acquiredAt.set(frameId, timestampMs);
    }

    if ((kind === "processed" || kind === "rendered") && frameId !== undefined) {
      const acquiredAt = this.acquiredAt.get(frameId);
      if (acquiredAt !== undefined) {
        const duration = Math.max(0, timestampMs - acquiredAt);
        if (kind === "processed") this.processingTimes.push(duration);
        if (kind === "rendered") this.frameAges.push(duration);
      }
    }
  }

  snapshot(timestampMs = performance.now()): DiagnosticSample {
    this.trim(timestampMs);
    const processedFps = this.records.processed.length;
    return {
      timestampMs,
      previewFps: this.records.preview.length,
      acquiredFps: this.records.acquired.length,
      processedFps,
      uiFps: this.records.rendered.length,
      frameAgeMsP50: percentile(this.frameAges, 0.5),
      frameAgeMsP95: percentile(this.frameAges, 0.95),
      droppedFrames: this.droppedFrames,
      workerProcessingMsP95: percentile(this.processingTimes, 0.95),
      memoryBytes: readMemoryBytes(),
      batteryLevel: this.batteryLevel,
      thermalSignal: this.osThermalWarning
        ? "os-warning"
        : processedFps > 0 && processedFps < 8
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
    this.lastAcquiredFrameId = null;
    this.droppedFrames = 0;
  }

  private trim(now: number): void {
    const cutoff = now - this.windowMs;
    for (const kind of Object.keys(this.records) as DiagnosticKind[]) {
      this.records[kind] = this.records[kind].filter(
        (record) => record.timestampMs >= cutoff && record.timestampMs <= now,
      );
    }
  }
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? 0;
}

function readMemoryBytes(): number | null {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  }).memory;
  return typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null;
}
