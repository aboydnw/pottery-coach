export type RegionOfInterest = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AcquiredFrame = {
  frameId: number;
  capturedAtMs: number;
  bitmap: ImageBitmap;
};

export type FrameSink = (frame: AcquiredFrame) => "accepted" | "busy";

export type FrameSourceOptions = {
  targetFps: number;
  roi: RegionOfInterest;
};

export interface FrameSource {
  start(video: HTMLVideoElement, options: FrameSourceOptions, sink: FrameSink): void;
  updateOptions?(options: FrameSourceOptions): void;
  stop(): void;
}

export const ENABLE_TRACK_PROCESSOR = false;
