import { expect, it } from "vitest";

import { toWetGoal } from "./sizeGoal";
import type { ThrowingGoal } from "./types";

const base: ThrowingGoal = { id: "goal-1", targetId: "straight-cylinder-v1", basis: "wet", desiredHeightMm: 300, desiredMaximumWidthMm: 120, shrinkageFraction: null };

it("converts a 300 mm fired goal with 12% shrinkage to 340.91 mm wet", () => {
  const result = toWetGoal({ ...base, basis: "fired", shrinkageFraction: 0.12 });
  expect(result.wetHeightMm).toBeCloseTo(340.9090909);
  expect(result.equation).toContain("300 ÷ (1 − 0.12)");
});

it("keeps wet dimensions unchanged", () => {
  expect(toWetGoal(base).wetHeightMm).toBe(300);
});

it("blocks fired goals without explicit shrinkage", () => {
  expect(() => toWetGoal({ ...base, basis: "fired" })).toThrow(/shrinkage/i);
});

it.each([-0.01, 0.26])("rejects shrinkage %s outside the supported range", (shrinkageFraction) => {
  expect(() => toWetGoal({ ...base, basis: "fired", shrinkageFraction })).toThrow(/between 0 and 0.25/i);
});
