import { expect, it } from "vitest";
import { generateProfileFixtures } from "../../benchmarks/profile/generate";

it("covers every coaching region at ±2/5/10/20 mm with deterministic noise", () => {
  const first = generateProfileFixtures(42), second = generateProfileFixtures(42);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(new Set(first.map((fixture) => fixture.region))).toEqual(new Set(["base", "lower-body", "upper-body", "rim"]));
  expect(new Set(first.map((fixture) => fixture.deltaMm))).toEqual(new Set([-20, -10, -5, -2, 2, 5, 10, 20]));
});
