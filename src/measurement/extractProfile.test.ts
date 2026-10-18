import { expect, it } from "vitest";

import { extractDimensions } from "./extractProfile";

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
