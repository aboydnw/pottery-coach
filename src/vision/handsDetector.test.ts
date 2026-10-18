import { describe, expect, it } from "vitest";
import type { DimensionReading } from "../measurement/types";
import { HandsDetector } from "./handsDetector";

function reading(timestampMs: number, width: number, height = 300): DimensionReading {
  return {
    id: `r${timestampMs}`,
    timestampMs,
    sourceFrameId: timestampMs,
    calibrationId: "uncalibrated",
    unit: "px",
    height,
    maximumWidth: width,
    rimWidth: width,
    baseWidth: width,
    centerlineOffset: 0,
    profile: [],
    visibleAsymmetry: 0,
    confidence: {
      overall: 1,
      calibration: { score: 1, reasons: [] },
      segmentation: { score: 1, reasons: [] },
      occlusion: { score: 1, reasons: [] },
      temporalStability: { score: 1, reasons: [] },
      freshnessMs: 0,
      estimatedError95: null,
    },
  };
}

function feed(detector: HandsDetector, widths: number[], startMs = 0): boolean[] {
  return widths.map((width, index) => detector.update(reading(startMs + index * 100, width)));
}

describe("HandsDetector", () => {
  it("stays off while a spinning pot keeps a steady outline", () => {
    expect(feed(new HandsDetector(), [200, 201, 199, 200, 202, 200, 201])).not.toContain(true);
  });

  it("turns on when the outline jumps around", () => {
    expect(feed(new HandsDetector(), [200, 200, 230, 205, 240]).at(-1)).toBe(true);
  });

  it("turns on when the outline suddenly grows past the hands-off baseline", () => {
    const detector = new HandsDetector();
    feed(detector, [200, 200, 200, 200, 200]);
    expect(detector.update(reading(600, 240))).toBe(true);
  });

  it("releases only after the outline has been steady for a second", () => {
    const detector = new HandsDetector();
    feed(detector, [200, 240, 200, 250, 210]);
    const steady = feed(detector, [220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220], 500);
    expect(steady.slice(0, 8)).not.toContain(false);
    expect(steady.at(-1)).toBe(false);
  });

  it("accepts the new shape as the baseline after hands come off", () => {
    const detector = new HandsDetector();
    feed(detector, [200, 240, 200, 250, 210]);
    feed(detector, Array.from({ length: 20 }, () => 260), 500);
    expect(detector.update(reading(3_000, 262))).toBe(false);
  });

  it("starts fresh after a reset", () => {
    const detector = new HandsDetector();
    feed(detector, [200, 240, 200, 250]);
    detector.reset();
    expect(detector.update(reading(1_000, 300))).toBe(false);
  });
});
