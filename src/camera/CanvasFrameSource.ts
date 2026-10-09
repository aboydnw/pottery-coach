import type { FrameSink, FrameSource, FrameSourceOptions } from "./FrameSource";

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export class CanvasFrameSource implements FrameSource {
  private video: VideoWithFrameCallback | null = null;
  private options: FrameSourceOptions | null = null;
  private sink: FrameSink | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callbackHandle: number | null = null;
  private frameId = 0;
  private lastCaptureAt = -Infinity;
  private active = false;

  start(
    video: HTMLVideoElement,
    options: FrameSourceOptions,
    sink: FrameSink,
  ): void {
    this.stop();
    if (!Number.isFinite(options.targetFps) || options.targetFps <= 0) {
      throw new RangeError("targetFps must be greater than zero");
    }
    this.video = video;
    this.options = options;
    this.sink = sink;
    this.active = true;
    this.lastCaptureAt = performance.now();
    this.schedule();
  }

  stop(): void {
    this.active = false;
    if (this.timer !== null) clearTimeout(this.timer);
    if (
      this.callbackHandle !== null &&
      this.video?.cancelVideoFrameCallback
    ) {
      this.video.cancelVideoFrameCallback(this.callbackHandle);
    }
    this.timer = null;
    this.callbackHandle = null;
    this.video = null;
    this.options = null;
    this.sink = null;
  }

  private schedule(): void {
    if (!this.active || !this.video || !this.options) return;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.callbackHandle = this.video.requestVideoFrameCallback((now) => {
        void this.onFrame(now);
      });
      return;
    }

    const intervalMs = 1000 / this.options.targetFps;
    this.timer = setTimeout(() => {
      void this.onFrame(performance.now());
    }, intervalMs);
  }

  private async onFrame(now: number): Promise<void> {
    if (!this.active || !this.video || !this.options || !this.sink) return;
    const intervalMs = 1000 / this.options.targetFps;

    if (now - this.lastCaptureAt + 0.01 >= intervalMs) {
      this.lastCaptureAt = now;
      const { x, y, width, height } = this.options.roi;
      const bitmap = await createImageBitmap(this.video, x, y, width, height);
      if (!this.active || !this.sink) {
        bitmap.close();
        return;
      }
      const result = this.sink({
        frameId: ++this.frameId,
        capturedAtMs: now,
        bitmap,
      });
      if (result === "busy") bitmap.close();
    }

    this.schedule();
  }
}
