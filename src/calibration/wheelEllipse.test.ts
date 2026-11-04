import { describe, expect, it } from "vitest";
import { canonicalWheelEllipse, detectWheelEllipses } from "./wheelEllipse";

describe("canonicalWheelEllipse", () => {
  it("keeps the larger radius on the major axis", () => {
    expect(
      canonicalWheelEllipse({
        centerX: 10,
        centerY: 20,
        radiusMajor: 40,
        radiusMinor: 80,
        rotationRad: 0,
        fitResidualPx95: 1,
        visibleArcFraction: 0.9,
        confidence: 0.8,
      }),
    ).toMatchObject({ radiusMajor: 80, radiusMinor: 40, rotationRad: Math.PI / 2 });
  });

  it("rejects non-finite and non-positive geometry", () => {
    expect(() =>
      canonicalWheelEllipse({
        centerX: 10,
        centerY: 20,
        radiusMajor: 0,
        radiusMinor: 10,
        rotationRad: 0,
        fitResidualPx95: 1,
        visibleArcFraction: 1,
        confidence: 1,
      }),
    ).toThrow(/positive/i);
  });

  it("accepts ellipse candidates carrying non-numeric scoring metadata", () => {
    const candidate = {
      centerX: 160,
      centerY: 140,
      radiusMajor: 96,
      radiusMinor: 30,
      rotationRad: 0,
      fitResidualPx95: 1,
      visibleArcFraction: 1,
      confidence: 0.9,
      score: 0.8,
      evidence: { supportedSectors: new Uint8Array(72) },
    };

    expect(() => canonicalWheelEllipse(candidate)).not.toThrow();
  });
});

it("detects a complete dark wheel ellipse against a light background", () => {
  const width = 320;
  const height = 240;
  const gray = new Float32Array(width * height).fill(190);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - 165) / 100;
      const dy = (y - 175) / 45;
      if (dx * dx + dy * dy <= 1) gray[y * width + x] = 70;
    }
  }
  const [candidate] = detectWheelEllipses({ gray, width, height });
  expect(candidate).toBeDefined();
  expect(candidate!.centerX).toBeCloseTo(165, 0);
  expect(candidate!.centerY).toBeCloseTo(175, 0);
  expect(candidate!.radiusMajor).toBeCloseTo(100, 0);
  expect(candidate!.radiusMinor).toBeCloseTo(45, 0);
  expect(candidate!.visibleArcFraction).toBeGreaterThan(0.9);
  expect(candidate!.confidence).toBeGreaterThan(0.8);
});

it("detects a complete light wheel ellipse against a dark background", () => {
  const width = 320;
  const height = 240;
  const gray = new Float32Array(width * height).fill(65);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - 165) / 100;
      const dy = (y - 175) / 45;
      if (dx * dx + dy * dy <= 1) gray[y * width + x] = 155;
    }
  }

  const [candidate] = detectWheelEllipses({ gray, width, height });

  expect(candidate).toBeDefined();
  expect(candidate!.centerX).toBeCloseTo(165, 0);
  expect(candidate!.centerY).toBeCloseTo(175, 0);
  expect(candidate!.radiusMajor).toBeCloseTo(100, 0);
  expect(candidate!.radiusMinor).toBeCloseTo(45, 0);
});

it("does not claim a complete rim when the ellipse is clipped", () => {
  const width = 200;
  const height = 160;
  const gray = new Float32Array(width * height).fill(190);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - 20) / 80;
      const dy = (y - 120) / 30;
      if (dx * dx + dy * dy <= 1) gray[y * width + x] = 60;
    }
  }
  expect(detectWheelEllipses({ gray, width, height })).toEqual([]);
});
