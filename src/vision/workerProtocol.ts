import type { AcquiredFrame } from "../camera/FrameSource";
import type { SessionScale } from "../measurement/scale";
import type { DimensionReading, StableDimensionReading } from "../measurement/types";
import type { WobbleReading } from "../wobble/types";
import type { BackgroundModel } from "./backgroundModel";

export type FrameRequest = {
  type: "frame";
  frameId: number;
  capturedAtMs: number;
  droppedBefore: number;
  bitmap: ImageBitmap;
  /** Source video pixels per bitmap pixel. */
  scale: number;
};

export type DiagnosticResponse = {
  type: "diagnostic";
  frameId: number;
  processingMs: number;
  droppedBefore: number;
  /** Present when the worker could not process the frame; the pipeline keeps running. */
  error?: string;
};

export type MeasurementWorkerRequest =
  | { type: "scale"; scale: SessionScale | null; imageCenterlineX?: number }
  | FrameRequest
  | { type: "reset"; reason: string }
  /** Restores an empty-wheel background learned before a restart, so a pot already on the wheel isn't mistaken for background. */
  | { type: "background"; model: BackgroundModel };

export type MeasurementWorkerEvent =
  | { type: "reading"; instantaneous: DimensionReading; stable: StableDimensionReading | null }
  | { type: "wobble"; reading: WobbleReading }
  | DiagnosticResponse
  | { type: "invalidated"; reason: string }
  /** The empty-wheel background is learned; the potter can put their clay on. */
  | { type: "background-ready"; model: BackgroundModel };

/**
 * Keeps at most one frame in flight to the measurement worker. Frames offered while the worker is
 * busy are refused so the producer can close them, which bounds memory and keeps readings fresh.
 */
export class BoundedWorkerSink {
  private pending = false;
  private dropped = 0;

  constructor(
    private readonly worker: Worker,
    private readonly onDiagnostic?: (diagnostic: DiagnosticResponse) => void,
  ) {
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onError);
  }

  get droppedFrames(): number {
    return this.dropped;
  }

  submit(frame: AcquiredFrame): "accepted" | "busy" {
    if (this.pending) {
      this.dropped += 1;
      return "busy";
    }
    this.pending = true;
    const request: FrameRequest = {
      type: "frame",
      frameId: frame.frameId,
      capturedAtMs: frame.capturedAtMs,
      droppedBefore: this.dropped,
      bitmap: frame.bitmap,
      scale: frame.scale,
    };
    this.worker.postMessage(request, [frame.bitmap]);
    return "accepted";
  }

  dispose(): void {
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onError);
  }

  private readonly onMessage = (event: MessageEvent<DiagnosticResponse>): void => {
    if (event.data?.type !== "diagnostic") return;
    this.pending = false;
    this.onDiagnostic?.(event.data);
  };

  private readonly onError = (): void => {
    this.pending = false;
  };
}
