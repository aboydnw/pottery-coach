/// <reference lib="webworker" />

import { buildBackground, type LabImage } from "./backgroundModel";
import { segmentVessel } from "./segmentVessel";
import { extractDimensions } from "../measurement/extractProfile";
import { scoreConfidence } from "../measurement/confidence";
import { TemporalFilter } from "../measurement/temporalFilter";
import type { CalibrationResult } from "../calibration/types";
import type { DiagnosticResponse, MeasurementWorkerEvent, MeasurementWorkerRequest } from "./workerProtocol";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let calibration: CalibrationResult | null = null;
let backgroundFrames: LabImage[] = [];
let background: ReturnType<typeof buildBackground> | null = null;
const temporalFilter = new TemporalFilter();

worker.addEventListener("message", async (event: MessageEvent<MeasurementWorkerRequest>) => {
  if (event.data?.type === "configure") {
    calibration = event.data.calibration;
    backgroundFrames = [];
    background = null;
    temporalFilter.reset("calibration-change");
    return;
  }
  if (event.data?.type === "reset") {
    temporalFilter.reset(event.data.reason);
    backgroundFrames = [];
    background = null;
    const invalidated: MeasurementWorkerEvent = { type: "invalidated", reason: event.data.reason };
    worker.postMessage(invalidated);
    return;
  }
  if (event.data?.type !== "frame") return;
  const startedAt = performance.now();
  try {
    if (calibration) {
      const image = bitmapToLab(event.data.bitmap);
      if (!background) {
        backgroundFrames.push(image);
        if (backgroundFrames.length >= 5) background = buildBackground(backgroundFrames);
      } else {
        const segmentation = segmentVessel(image, background, []);
        const reliableFraction = segmentation.rowReliability.reduce((sum, value) => sum + value, 0) / image.height;
        const confidence = scoreConfidence({
          calibration: { score: calibration.status === "accepted" ? 1 : 0, reasons: calibration.reasons },
          segmentation: { score: reliableFraction, reasons: segmentation.reasons },
          occlusion: { score: reliableFraction, reasons: reliableFraction < 0.7 ? ["OCCLUDED_ROWS"] : [] },
          temporalStability: { score: 1, reasons: [] },
          capturedAtMs: event.data.capturedAtMs,
          nowMs: performance.now(),
          calibrationErrorMm95: calibration.quality.estimatedErrorMm95,
          segmentationErrorMm95: reliableFraction >= 0.7 ? 3 : 10,
        });
        const mmPerPixel = estimateMmPerPixel(calibration);
        const instantaneous = extractDimensions(segmentation.mask, segmentation.rowReliability, {
          width: image.width,
          height: image.height,
          mmPerPixel,
          centerlineX: image.width / 2,
          calibrationId: calibration.id,
          frameId: event.data.frameId,
          timestampMs: event.data.capturedAtMs,
          confidence,
        });
        const reading: MeasurementWorkerEvent = {
          type: "reading",
          instantaneous,
          stable: temporalFilter.push(instantaneous),
        };
        worker.postMessage(reading);
      }
    }
  } finally {
    event.data.bitmap.close();
  }
  const response: DiagnosticResponse = {
    type: "diagnostic",
    frameId: event.data.frameId,
    processingMs: performance.now() - startedAt,
    droppedBefore: event.data.droppedBefore,
  };
  worker.postMessage(response);
});

function bitmapToLab(bitmap: ImageBitmap): LabImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OffscreenCanvas 2D context unavailable");
  context.drawImage(bitmap, 0, 0);
  const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const lab = new Float32Array(bitmap.width * bitmap.height * 3);
  for (let pixel = 0, source = 0; pixel < bitmap.width * bitmap.height; pixel += 1, source += 4) {
    const converted = rgbToLab(rgba[source]!, rgba[source + 1]!, rgba[source + 2]!);
    lab.set(converted, pixel * 3);
  }
  return { width: bitmap.width, height: bitmap.height, lab };
}

function rgbToLab(red: number, green: number, blue: number): [number, number, number] {
  const linear = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized > 0.04045 ? ((normalized + 0.055) / 1.055) ** 2.4 : normalized / 12.92;
  });
  const x = (linear[0]! * 0.4124 + linear[1]! * 0.3576 + linear[2]! * 0.1805) / 0.95047;
  const y = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  const z = (linear[0]! * 0.0193 + linear[1]! * 0.1192 + linear[2]! * 0.9505) / 1.08883;
  const f = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function estimateMmPerPixel(value: CalibrationResult): number {
  const matrix = value.homographyImageToMm;
  return (Math.hypot(matrix[0], matrix[3]) + Math.hypot(matrix[1], matrix[4])) / 2;
}
