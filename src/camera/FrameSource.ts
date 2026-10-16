export type RegionOfInterest = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AcquiredFrame = {
  frameId: number;
  /** Capture time in epoch milliseconds (see `epochNow`). */
  capturedAtMs: number;
  bitmap: ImageBitmap;
  /** Region of the source video, in video pixels, that the bitmap covers. */
  sourceRoi: RegionOfInterest;
  /** Source video pixels per bitmap pixel; greater than 1 when the frame was downscaled. */
  scale: number;
};

export type FrameSink = (frame: AcquiredFrame) => "accepted" | "busy";

export type FrameSourceOptions = {
  targetFps: number;
  /** Region of the video to sample; defaults to the whole frame at its current size (which can change on rotation). */
  roi?: RegionOfInterest;
  /** Frames wider than this are downscaled before processing, keeping the aspect ratio. */
  maxOutputWidth?: number;
};

export interface FrameSource {
  start(video: HTMLVideoElement, options: FrameSourceOptions, sink: FrameSink): void;
  updateOptions?(options: Partial<FrameSourceOptions>): void;
  stop(): void;
}

export const DEFAULT_PROCESSING_WIDTH = 320;
