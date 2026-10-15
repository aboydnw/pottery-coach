import { expect, it, vi } from "vitest";

import { createToolRegistry } from "./registry";

const component = { score: 0.9, reasons: [] };
const confidence = {
  overall: 0.9,
  calibration: component,
  segmentation: component,
  occlusion: component,
  temporalStability: component,
  freshnessMs: 100,
  estimatedErrorMm95: 5,
};

it("rejects unknown/invalid calls and returns evidence-backed measurement facts", async () => {
  const registry = createToolRegistry({
    now: () => 1000,
    getDimensions: () => ({
      id: "reading-1",
      timestampMs: 900,
      sourceFrameId: 1,
      calibrationId: "cal",
      heightMm: 123.456,
      maximumWidthMm: 50,
      rimWidthMm: 45,
      baseWidthMm: 48,
      centerlineOffsetMm: 0,
      visibleAsymmetryMm: 0,
      profile: [],
      confidence,
    }),
    getWobble: () => ({
      id: "w-1",
      timestampMs: 900,
      amplitudeMm: null,
      periodMs: null,
      classification: "unmeasurable",
      confidence: 0,
      evidenceWindowMs: 0,
      observedRevolutions: 0,
      validSampleFraction: 0,
      cameraMotionRmsMm: null,
      lastReliableTimestampMs: null,
      reasons: ["NO_EVIDENCE"],
      sourceFrameIds: [],
    }),
    getComparison: () => null,
    setGoal: vi.fn(async (goal) => ({
      goal,
      wetHeightMm: goal.desiredHeightMm,
      wetMaximumWidthMm: null,
      equation: "wet",
    })),
    setPaused: vi.fn(),
    markMoment: vi.fn(async () => ({ id: "moment-1", timestampMs: 1000 })),
    setWheelHeadDiameter: vi.fn(async (diameterMm: number) => ({ diameterMm })),
  });
  await expect(registry.call("unknown", {})).rejects.toThrow(/unknown tool/i);
  await expect(registry.call("setGoal", {})).rejects.toThrow(/invalid/i);
  await expect(registry.call("getCurrentDimensions", {})).resolves.toEqual(
    expect.objectContaining({ evidenceId: "reading-1", heightMm: 123.5 }),
  );
});

it("returns unmeasurable rather than stale numeric dimensions", async () => {
  const registry = createToolRegistry({
    now: () => 5000,
    getDimensions: () => null,
    getWobble: () => null,
    getComparison: () => null,
    setGoal: vi.fn(),
    setPaused: vi.fn(),
    markMoment: vi.fn(),
    setWheelHeadDiameter: vi.fn(),
  });
  await expect(registry.call("getCurrentDimensions", {})).resolves.toEqual(
    expect.objectContaining({ measurable: false, reason: "NO_CURRENT_READING" }),
  );
});

it("records a stated wheel-head size and rejects implausible ones", async () => {
  const setWheelHeadDiameter = vi.fn(async (diameterMm: number) => ({ diameterMm }));
  const registry = createToolRegistry({
    now: () => 0,
    getDimensions: () => null,
    getWobble: () => null,
    getComparison: () => null,
    setGoal: vi.fn(),
    setPaused: vi.fn(),
    markMoment: vi.fn(),
    setWheelHeadDiameter,
  });
  await expect(registry.call("setWheelHeadDiameter", { diameterMm: 355.6 })).resolves.toEqual({ diameterMm: 355.6 });
  await expect(registry.call("setWheelHeadDiameter", { diameterMm: 14 })).rejects.toThrow();
  expect(setWheelHeadDiameter).toHaveBeenCalledOnce();
});
