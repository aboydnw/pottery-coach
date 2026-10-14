import { toEpochMs } from "../platform/clock";
import { DEFAULT_PROCESSING_WIDTH, type FrameSink, type FrameSource, type FrameSourceOptions } from "./FrameSource";

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Samples a video element at a bounded rate and hands downscaled `ImageBitmap`s to a sink.
 * Uses `requestVideoFrameCallback` when available and a timer otherwise.
 */
export class CanvasFrameSource implements FrameSource {
  private video: VideoWithFrameCallback | null = null;
  private options: Required<FrameSourceOptions> | null = null;
  private sink: FrameSink | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callbackHandle: number | null = null;
  private frameId = 0;
  private lastCaptureAt = -Infinity;
  private generation = 0;

  start(video: HTMLVideoElement, options: FrameSourceOptions, sink: FrameSink): void {
    this.stop();
    assertValidRate(options.targetFps);
    this.video = video;
    this.options = { maxOutputWidth: DEFAULT_PROCESSING_WIDTH, ...options };
    this.sink = sink;
    this.lastCaptureAt = performance.now();
    this.schedule(this.generation);
  }

  stop(): void {
    this.generation += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.callbackHandle !== null && this.video?.cancelVideoFrameCallback) {
      this.video.cancelVideoFrameCallback(this.callbackHandle);
    }
    this.timer = null;
    this.callbackHandle = null;
    this.video = null;
    this.options = null;
    this.sink = null;
  }

  updateOptions(options: Partial<FrameSourceOptions>): void {
    if (options.targetFps !== undefined) assertValidRate(options.targetFps);
    if (this.options) this.options = { ...this.options, ...options };
  }

  private schedule(generation: number): void {
    if (generation !== this.generation || !this.video || !this.options) return;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.callbackHandle = this.video.requestVideoFrameCallback((now) => void this.onFrame(now, generation));
      return;
    }
    this.timer = setTimeout(() => void this.onFrame(performance.now(), generation), 1000 / this.options.targetFps);
  }

  private async onFrame(now: number, generation: number): Promise<void> {
    if (generation !== this.generation || !this.video || !this.options || !this.sink) return;
    if (now - this.lastCaptureAt + 0.01 >= 1000 / this.options.targetFps) {
      this.lastCaptureAt = now;
      const { roi, maxOutputWidth } = this.options;
      const outputWidth = Math.max(1, Math.min(Math.round(roi.width), Math.round(maxOutputWidth)));
      const scale = roi.width / outputWidth;
      try {
        const bitmap = await createImageBitmap(this.video, roi.x, roi.y, roi.width, roi.height, {
          resizeWidth: outputWidth,
          resizeHeight: Math.max(1, Math.round(roi.height / scale)),
          resizeQuality: "low",
        });
        if (generation !== this.generation || !this.sink) {
          bitmap.close();
          return;
        }
        const result = this.sink({ frameId: ++this.frameId, capturedAtMs: toEpochMs(now), bitmap, sourceRoi: { ...roi }, scale });
        if (result === "busy") bitmap.close();
      } catch {
        // The video can briefly have no decodable frame (startup, device switch); skip this tick.
      }
    }
    this.schedule(generation);
  }
}

function assertValidRate(targetFps: number): void {
  if (!Number.isFinite(targetFps) || targetFps <= 0) throw new RangeError("targetFps must be greater than zero");
}
