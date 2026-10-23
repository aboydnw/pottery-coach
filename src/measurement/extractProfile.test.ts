import { expect, it } from "vitest";

import { extractDimensions } from "./extractProfile";
import type { MeasurementTransform } from "./WheelPoseTransform";

it("extracts analytic dimensions and preserves unreliable rows as null profile gaps", () => {
  const width = 20;
  const height = 20;
  const mask = new Uint8Array(width * height);
  for (let y = 4; y <= 17; y += 1) for (let x = 6; x <= 13; x += 1) mask[y * width + x] = 1;
  const reliability = new Uint8Array(height).fill(1);
  reliability[10] = 0;

  const reading = extractDimensions(mask, reliability, {
    width,
    height,
    unitsPerPixel: 2,
    unit: "mm",
    centerlineX: 9.5,
    calibrationId: "cal-1",
    frameId: 7,
    timestampMs: 100,
  });

  expect(reading.height).toBe(28);
  expect(reading.maximumWidth).toBe(16);
  expect(reading.rimWidth).toBe(16);
  expect(reading.baseWidth).toBe(16);
  expect(reading.profile).toHaveLength(64);
  expect(reading.profile.some((sample) => sample.radius === null)).toBe(true);
  expect(reading.visibleAsymmetry).toBe(0);
});

it("uses a measurement transform instead of a constant pixel scale", () => {
  const transform: MeasurementTransform = {
    imageToWheel: ({ x, y }) => ({ radialMm: x * 2, verticalMm: (20 - y) * 3 }),
    radiusAt: (left, right) => right.x - left.x,
    estimatedErrorMm95At: () => 4,
  };
  const mask = new Uint8Array(20 * 20);
  const reliable = new Uint8Array(20);
  for (let y = 10; y <= 19; y += 1) {
    reliable[y] = 1;
    for (let x = 5; x <= 14; x += 1) mask[y * 20 + x] = 1;
  }
  const result = extractDimensions(mask, reliable, {
    width: 20,
    height: 20,
    unitsPerPixel: 1,
    unit: "mm",
    centerlineX: 10,
    calibrationId: "pose",
    frameId: 1,
    timestampMs: 1,
    transform,
  });
  expect(result.height).toBeCloseTo(27);
  expect(result.maximumWidth).toBeCloseTo(18);
  expect(result.confidence.estimatedError95).toBe(4);
});

it("measures how far the top leans from the base", () => {
  const width = 40;
  const height = 20;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const shift = y < 6 ? 4 : 0;
    for (let x = 10 + shift; x <= 20 + shift; x += 1) mask[y * width + x] = 1;
  }
  const reading = extractDimensions(mask, new Uint8Array(height).fill(1), {
    width,
    height,
    unitsPerPixel: 1,
    unit: "px",
    centerlineX: 15,
    calibrationId: "uncalibrated",
    frameId: 1,
    timestampMs: 0,
  });
  expect(reading.leanOffset).toBe(4);
});
