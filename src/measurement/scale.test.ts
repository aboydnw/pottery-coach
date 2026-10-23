import { expect, it } from "vitest";
import { proportionsOf, scaleFromCalibration, toMm, type SessionScale } from "./scale";
import { wheelEllipseCalibration } from "../calibration/wheelHead";
import type { DimensionReading } from "./types";

const component = { score: 1, reasons: [] };
const pixelReading: DimensionReading = {
  id: "r1",
  timestampMs: 0,
  sourceFrameId: 1,
  calibrationId: "none",
  unit: "px",
  height: 400,
  maximumWidth: 200,
  rimWidth: 180,
  baseWidth: 160,
  centerlineOffset: 4,
  visibleAsymmetry: 2,
  profile: [
    { heightRatio: 0, radius: 80, confidence: 1 },
    { heightRatio: 1, radius: null, confidence: 0 },
  ],
  confidence: {
    overall: 0.9,
    calibration: component,
    segmentation: component,
    occlusion: component,
    temporalStability: component,
    freshnessMs: 0,
    estimatedError95: 4,
  },
};
const scale: SessionScale = {
  mmPerPixel: 0.25,
  method: "wheel-head",
  calibrationId: "c1",
  estimatedErrorMm95: 1,
  confirmedAtMs: 0,
};

it("converts every length and the error estimate once a scale exists", () => {
  const converted = toMm(pixelReading, scale)!;
  expect(converted).toMatchObject({
    unit: "mm",
    height: 100,
    maximumWidth: 50,
    rimWidth: 45,
    baseWidth: 40,
    centerlineOffset: 1,
  });
  expect(converted.profile.map((sample) => sample.radius)).toEqual([20, null]);
  expect(converted.confidence.estimatedError95).toBe(2);
});

it("returns nothing for pixel readings before calibration and passes millimetre readings through", () => {
  expect(toMm(pixelReading, null)).toBeNull();
  const millimetres = toMm(pixelReading, scale)!;
  expect(toMm(millimetres, null)).toBe(millimetres);
});

it("reports scale-free proportions", () => {
  expect(proportionsOf(pixelReading)).toEqual({ heightToWidth: 2, rimToBase: 1.125 });
});

it("carries authoritative wheel pose into the worker scale envelope", () => {
  const calibration = wheelEllipseCalibration({
    ellipse: {
      centerX: 320,
      centerY: 400,
      radiusMajor: 150,
      radiusMinor: 75,
      rotationRad: 0,
      fitResidualPx95: 0.5,
      visibleArcFraction: 1,
      confidence: 0.95,
    },
    diameterMm: 300,
    frameWidth: 640,
    frameHeight: 480,
    adjustedByUser: false,
  });
  expect(scaleFromCalibration(calibration)?.wheelViewPose).toEqual(calibration.wheelViewPose);
});
