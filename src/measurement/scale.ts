import type { CalibrationMethod, CalibrationResult } from "../calibration/types";
import type { WheelViewPose } from "../calibration/wheelViewPose";
import type { DimensionReading } from "./types";

/** Converts full-resolution camera pixels to millimetres for one session. */
export type SessionScale = {
  mmPerPixel: number;
  method: Exclude<CalibrationMethod, "none">;
  calibrationId: string;
  /** 95th-percentile error of the scale itself, in millimetres. */
  estimatedErrorMm95: number;
  confirmedAtMs: number;
  /** Authoritative weak-perspective geometry for angled wheel-head sessions. */
  wheelViewPose?: WheelViewPose;
};

/** Mean millimetres per pixel of a calibration's image-to-board homography. */
export function mmPerPixelOf(calibration: CalibrationResult): number {
  const matrix = calibration.homographyImageToMm;
  return (Math.hypot(matrix[0], matrix[3]) + Math.hypot(matrix[1], matrix[4])) / 2;
}

/** The session scale an accepted calibration provides, or null when it carries no real-world size. */
export function scaleFromCalibration(calibration: CalibrationResult, confirmedAtMs = Date.now()): SessionScale | null {
  if (calibration.method === "none" || calibration.status !== "accepted") return null;
  return {
    mmPerPixel: mmPerPixelOf(calibration),
    method: calibration.method,
    calibrationId: calibration.id,
    estimatedErrorMm95: calibration.quality.estimatedErrorMm95,
    confirmedAtMs,
    ...(calibration.wheelViewPose ? { wheelViewPose: calibration.wheelViewPose } : {}),
  };
}

/**
 * Returns the reading in millimetres, or null when it is in pixels and no scale exists yet. This is
 * the only place pixel measurements become sizes, so a scale set later applies to earlier readings.
 */
export function toMm<T extends DimensionReading>(reading: T, scale: SessionScale | null): T | null {
  if (reading.unit === "mm") return reading;
  if (!scale) return null;
  const convert = (value: number | null) => (value === null ? null : value * scale.mmPerPixel);
  const readingError = reading.confidence.estimatedError95;
  return {
    ...reading,
    unit: "mm",
    height: convert(reading.height),
    maximumWidth: convert(reading.maximumWidth),
    rimWidth: convert(reading.rimWidth),
    baseWidth: convert(reading.baseWidth),
    centerlineOffset: convert(reading.centerlineOffset),
    visibleAsymmetry: convert(reading.visibleAsymmetry),
    leanOffset: convert(reading.leanOffset ?? null),
    profile: reading.profile.map((sample) => ({ ...sample, radius: convert(sample.radius) })),
    confidence: {
      ...reading.confidence,
      estimatedError95: (readingError === null ? 0 : readingError * scale.mmPerPixel) + scale.estimatedErrorMm95,
    },
  };
}

/** Scale-free shape facts that are meaningful without calibration. */
export function proportionsOf(reading: DimensionReading): { heightToWidth: number | null; rimToBase: number | null } {
  const ratio = (top: number | null, bottom: number | null) =>
    top === null || bottom === null || bottom === 0 ? null : top / bottom;
  return {
    heightToWidth: ratio(reading.height, reading.maximumWidth),
    rimToBase: ratio(reading.rimWidth, reading.baseWidth),
  };
}
