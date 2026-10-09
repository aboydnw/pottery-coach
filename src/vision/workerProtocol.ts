import type { AcquiredFrame } from "../camera/FrameSource";
import type { CalibrationResult } from "../calibration/types";
import type { DimensionReading, StableDimensionReading } from "../measurement/types";

export type FrameRequest = {
  type: "frame";
  frameId: number;
  capturedAtMs: number;
  droppedBefore: number;
  bitmap: ImageBitmap;
};

export type DiagnosticResponse = {
  type: "diagnostic";
  frameId: number;
  processingMs: number;
  droppedBefore: number;
};

export type MeasurementWorkerRequest =
  | { type: "configure"; calibration: CalibrationResult }
  | FrameRequest
  | { type: "reset"; reason: string };

export type MeasurementWorkerEvent =
  | { type: "reading"; instantaneous: DimensionReading; stable: StableDimensionReading | null }
  | DiagnosticResponse
  | { type: "invalidated"; reason: string };

export class BoundedWorkerSink {
  private pending = false;
  private dropped = 0;

  constructor(
    private readonly worker: Worker,
    private readonly onDiagnostic?: (diagnostic: DiagnosticResponse) => void,
  ) {
    worker.addEventListener("message", this.onMessage);
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
    };
    this.worker.postMessage(request, [frame.bitmap]);
    return "accepted";
  }

  dispose(): void {
    this.worker.removeEventListener("message", this.onMessage);
  }

  private readonly onMessage = (event: MessageEvent<DiagnosticResponse>): void => {
    if (event.data?.type !== "diagnostic") return;
    this.pending = false;
    this.onDiagnostic?.(event.data);
  };
}
