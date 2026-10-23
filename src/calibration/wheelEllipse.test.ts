import { describe, expect, it } from "vitest";
import { canonicalWheelEllipse } from "./wheelEllipse";

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
});
