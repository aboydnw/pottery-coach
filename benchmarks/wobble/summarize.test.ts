import { expect, it } from "vitest";
import { summarizeWobble } from "./summarize";

it("fails precision, false-alert, delay, recall, and camera suppression independently", () => {
  const summary = summarizeWobble([
    { expectedSignificant: true, predictedSignificant: false, amplitudeMm: 10, delayRevolutions: null, cameraNegative: false },
    { expectedSignificant: false, predictedSignificant: true, amplitudeMm: 0, delayRevolutions: 4, cameraNegative: true },
  ], 5);
  expect(Object.values(summary.gates).every((value) => value === false)).toBe(true);
});
