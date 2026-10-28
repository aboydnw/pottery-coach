/// <reference lib="webworker" />
import { buildBackground, type LabImage } from "./backgroundModel";
import { segmentVessel } from "./segmentVessel";
import { extractDimensions } from "../measurement/extractProfile";
import { scoreConfidence } from "../measurement/confidence";
import { TemporalFilter } from "../measurement/temporalFilter";
import { toMm, type SessionScale } from "../measurement/scale";
import type { DimensionReading } from "../measurement/types";
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
import { bitmapToPixels, type BitmapPixels } from "./lab";
import { HandsDetector } from "./handsDetector";
import { createWheelPoseTransform } from "../measurement/WheelPoseTransform";
import type { WheelViewPose } from "../calibration/wheelViewPose";

const BACKGROUND_FRAME_COUNT = 5;
/** Below the cue and voice-tool confidence bar, so hands-on readings are never spoken about. */
const HANDS_ON_CONFIDENCE = 0.5;
const worker = self as unknown as DedicatedWorkerGlobalScope;
let scale: SessionScale | null = null;
let imageCenterlineX: number | null = null;
let backgroundFrames: LabImage[] = [];
let background: ReturnType<typeof buildBackground> | null = null;
const temporalFilter = new TemporalFilter();
const contourBuffer = new TemporalContourBuffer();
const wobbleService = new WobbleService();
const handsDetector = new HandsDetector();
let pendingDatasetCaptureId: string | null = null;

worker.addEventListener("message", (event: MessageEvent<MeasurementWorkerRequest>) => {
  const request = event.data;
  if (request?.type === "scale") {
    // A scale can arrive at any time; pixel evidence stays valid, so nothing is reset.
    scale = request.scale;
    imageCenterlineX = request.imageCenterlineX ?? null;
    contourBuffer.clear("scale-change");
    return;
  }
  if (request?.type === "background") {
    resetEvidence("background-restored");
    background = request.model;
    return;
  }
  if (request?.type === "reset") {
    resetEvidence(request.reason);
    post({ type: "invalidated", reason: request.reason });
    return;
  }
  if (request?.type === "request-dataset-capture") {
    pendingDatasetCaptureId = request.captureId;
    return;
  }
  if (request?.type !== "frame") return;
  const startedAt = performance.now();
  let error: string | undefined;
  try {
    processFrame(request);
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

function processFrame(request: FrameRequest): void {
  const pixels = bitmapToPixels(request.bitmap);
  const image = pixels.lab;
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
      post({ type: "background-ready", model: background });
    }
    return;
  }
  const segmentation = segmentVessel(image, background, []);
  const reliableFraction = segmentation.reliableFraction;
  const pose = scale?.wheelViewPose ? poseForProcessedFrame(scale.wheelViewPose, request.scale) : null;
  const transform = pose ? createWheelPoseTransform(pose) : undefined;
  const confidence = scoreConfidence({
    calibration: pose ? { score: pose.confidence, reasons: pose.reasons } : { score: 1, reasons: [] },
    segmentation: { score: reliableFraction, reasons: segmentation.reasons },
    occlusion: { score: reliableFraction, reasons: reliableFraction < 0.7 ? ["OCCLUDED_ROWS"] : [] },
    temporalStability: { score: 1, reasons: [] },
    capturedAtMs: request.capturedAtMs,
    nowMs: epochNow(),
    calibrationError95: pose?.estimatedErrorMm95 ?? null,
    segmentationError95: (reliableFraction >= 0.7 ? 1 : 3) * request.scale,
  });
  const extracted = extractDimensions(segmentation.mask, segmentation.rowReliability, {
    width: image.width,
    height: image.height,
    unitsPerPixel: request.scale,
    unit: transform ? "mm" : "px",
    centerlineX: imageCenterlineX === null ? image.width / 2 : imageCenterlineX / request.scale,
    calibrationId: scale?.calibrationId ?? "uncalibrated",
    frameId: request.frameId,
    timestampMs: request.capturedAtMs,
    confidence,
    transform,
  });
  const measured = { ...extracted, segmentationVersion: segmentation.modelVersion ?? "background-v1" };
  const handsLikely = handsDetector.update(measured);
  const instantaneous = handsLikely ? withHands(measured) : { ...measured, handsLikely };
  // Hands-on frames would drag the steady reading towards the hands, so they don't feed it.
  post({ type: "reading", instantaneous, stable: handsLikely ? null : temporalFilter.push(instantaneous) });
  emitPendingDatasetCapture(pixels, segmentation, pose);
  if (handsLikely) return;
  // Wobble thresholds are physical sizes, so oscillation is only tracked once a scale exists.
  const instantaneousMm = toMm(instantaneous, scale);
  if (!instantaneousMm) return;
  contourBuffer.push(contourSampleFromReading(instantaneousMm));
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

function emitPendingDatasetCapture(
  pixels: BitmapPixels,
  segmentation: ReturnType<typeof segmentVessel>,
  pose: WheelViewPose | null,
): void {
  if (!pendingDatasetCaptureId) return;
  const captureId = pendingDatasetCaptureId;
  pendingDatasetCaptureId = null;
  const capture = {
    captureId,
    width: pixels.width,
    height: pixels.height,
    rgba: pixels.rgba,
    automaticMask: segmentation.mask,
    segmentationVersion: segmentation.modelVersion ?? "background-v1",
    calibrationId: scale?.calibrationId ?? "uncalibrated",
    wheelDiameterMm: scale?.boardPose?.wheelDiameterMm ?? null,
    calibrationGeometry: pose
      ? {
          wheelCenterImage: pose.wheelCenterImage,
          projectedVerticalImage: pose.projectedVerticalImage,
          supportedRegionImage: pose.supportedRegionImage,
          wheelPlaneMmPerMajorPixel: pose.wheelPlaneMmPerMajorPixel,
          estimatedErrorMm95: pose.estimatedErrorMm95,
        }
      : null,
  };
  post({ type: "dataset-capture", capture }, [capture.rgba.buffer, capture.automaticMask.buffer]);
}

function poseForProcessedFrame(pose: WheelViewPose, sourcePixelsPerBitmapPixel: number): WheelViewPose {
  const divide = (value: number) => value / sourcePixelsPerBitmapPixel;
  return {
    ...pose,
    wheelCenterImage: { x: divide(pose.wheelCenterImage.x), y: divide(pose.wheelCenterImage.y) },
    wheelPlaneMmPerMajorPixel: pose.wheelPlaneMmPerMajorPixel * sourcePixelsPerBitmapPixel,
    supportedRegionImage: {
      x: divide(pose.supportedRegionImage.x),
      y: divide(pose.supportedRegionImage.y),
      width: divide(pose.supportedRegionImage.width),
      height: divide(pose.supportedRegionImage.height),
    },
  };
}

function resetEvidence(reason: string): void {
  backgroundFrames = [];
  background = null;
  temporalFilter.reset(reason);
  contourBuffer.clear(reason);
  handsDetector.reset();
}

function withHands(reading: DimensionReading): DimensionReading {
  const occlusion = { score: HANDS_ON_CONFIDENCE, reasons: ["HANDS_LIKELY"] };
  return {
    ...reading,
    handsLikely: true,
    confidence: {
      ...reading.confidence,
      occlusion,
      overall: Math.min(reading.confidence.overall, HANDS_ON_CONFIDENCE),
    },
  };
}

function post(message: MeasurementWorkerEvent, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer);
}
