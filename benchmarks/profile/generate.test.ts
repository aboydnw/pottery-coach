import { expect, it } from "vitest";
import { generateProfileFixtures } from "./generate";
it("is byte deterministic for seed 42", () => {
  expect(JSON.stringify(generateProfileFixtures(42))).toBe(JSON.stringify(generateProfileFixtures(42)));
});
