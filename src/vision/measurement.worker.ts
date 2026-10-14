/// <reference lib="webworker" />
import { buildBackground, type LabImage } from "./backgroundModel";
import { segmentVessel } from "./segmentVessel";
import { extractDimensions } from "../measurement/extractProfile";
import { scoreConfidence } from "../measurement/confidence";
import { TemporalFilter } from "../measurement/temporalFilter";
import type { CalibrationResult } from "../calibration/types";
import type {
  DiagnosticResponse,
  FrameRequest,
  MeasurementWorkerEvent,
  MeasurementWorkerRequest,
} from "./workerProtocol";
import { TemporalContourBuffer } from "../wobble/TemporalContourBuffer";
import { contourSampleFromReading } from "../wobble/fromReading";
import { estimatePeriod } from "../wobble/period";
import { fitOscillation } from "../wobble/fitOscillation";
import { classifyWobble } from "../wobble/classifyWobble";
import { WobbleService } from "../wobble/WobbleService";
import { epochNow } from "../platform/clock";
import { bitmapToLab } from "./lab";

const BACKGROUND_FRAME_COUNT = 5;
const worker = self as unknown as DedicatedWorkerGlobalScope;
let calibration: CalibrationResult | null = null;
let backgroundFrames: LabImage[] = [];
let background: ReturnType<typeof buildBackground> | null = null;
const temporalFilter = new TemporalFilter();
const contourBuffer = new TemporalContourBuffer();
const wobbleService = new WobbleService();

worker.addEventListener("message", (event: MessageEvent<MeasurementWorkerRequest>) => {
  const request = event.data;
  if (request?.type === "configure") {
    calibration = request.calibration;
    resetEvidence("calibration-change");
    return;
  }
  if (request?.type === "reset") {
    resetEvidence(request.reason);
    post({ type: "invalidated", reason: request.reason });
    return;
  }
  if (request?.type !== "frame") return;
  const startedAt = performance.now();
  let error: string | undefined;
  try {
    if (calibration) processFrame(request, calibration);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Frame processing failed";
  } finally {
    request.bitmap.close();
  }
  const response: DiagnosticResponse = {
    type: "diagnostic",
    frameId: request.frameId,
    processingMs: performance.now() - startedAt,
    droppedBefore: request.droppedBefore,
    ...(error ? { error } : {}),
  };
  post(response);
});

function processFrame(request: FrameRequest, active: CalibrationResult): void {
  const image = bitmapToLab(request.bitmap);
  const reference = background ?? backgroundFrames[0];
  if (reference && (reference.width !== image.width || reference.height !== image.height)) {
    resetEvidence("frame-size-change");
    post({ type: "invalidated", reason: "frame-size-change" });
  }
  if (!background) {
    backgroundFrames.push(image);
    if (backgroundFrames.length >= BACKGROUND_FRAME_COUNT) {
      background = buildBackground(backgroundFrames);
      backgroundFrames = [];
    }
    return;
  }
  const segmentation = segmentVessel(image, background, []);
  const reliableFraction = segmentation.reliableFraction;
  const confidence = scoreConfidence({
    calibration: { score: active.status === "accepted" ? 1 : 0, reasons: active.reasons },
    segmentation: { score: reliableFraction, reasons: segmentation.reasons },
    occlusion: { score: reliableFraction, reasons: reliableFraction < 0.7 ? ["OCCLUDED_ROWS"] : [] },
    temporalStability: { score: 1, reasons: [] },
    capturedAtMs: request.capturedAtMs,
    nowMs: epochNow(),
    calibrationErrorMm95: active.quality.estimatedErrorMm95,
    segmentationErrorMm95: reliableFraction >= 0.7 ? 3 : 10,
  });
  const instantaneous = extractDimensions(segmentation.mask, segmentation.rowReliability, {
    width: image.width,
    height: image.height,
    mmPerPixel: estimateMmPerPixel(active) * request.scale,
    centerlineX: image.width / 2,
    calibrationId: active.id,
    frameId: request.frameId,
    timestampMs: request.capturedAtMs,
    confidence,
  });
  post({ type: "reading", instantaneous, stable: temporalFilter.push(instantaneous) });
  contourBuffer.push(contourSampleFromReading(instantaneous));
  const window = contourBuffer.window(12_000);
  const periodSamples = window.flatMap((sample) =>
    sample.rimCenterMm === null ? [] : [{ timestampMs: sample.timestampMs, value: sample.rimCenterMm }],
  );
  const period = estimatePeriod(periodSamples, { minMs: 300, maxMs: 3000 });
  if (period && periodSamples.length >= 20) {
    const fit = fitOscillation(periodSamples, period.periodMs);
    wobbleService.update(classifyWobble(window, fit, { periodMs: period.periodMs, cameraMotionRmsMm: null }));
    post({ type: "wobble", reading: wobbleService.getLatest(request.capturedAtMs) });
  }
}

function resetEvidence(reason: string): void {
  backgroundFrames = [];
  background = null;
  temporalFilter.reset(reason);
  contourBuffer.clear(reason);
}

function post(message: MeasurementWorkerEvent): void {
  worker.postMessage(message);
}

function estimateMmPerPixel(value: CalibrationResult): number {
  const matrix = value.homographyImageToMm;
  return (Math.hypot(matrix[0], matrix[3]) + Math.hypot(matrix[1], matrix[4])) / 2;
}
