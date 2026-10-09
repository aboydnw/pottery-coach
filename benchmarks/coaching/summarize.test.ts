import { expect, it } from "vitest";
import { summarizeCoaching } from "./summarize";

it("fails every trust invariant independently and reports cue rate", () => {
  const summary = summarizeCoaching([{ inventedMeasurement: true, staleClaim: true, lowConfidenceClaim: true,
    cooldownDuplicate: true, phaseConflict: true, prohibitedAdvice: true, unpromptedCue: true, durationMinutes: 0.5 }]);
  expect(summary.pass).toBe(false);
  expect(summary.violations).toEqual({ inventedMeasurement: 1, staleClaim: 1, lowConfidenceClaim: 1,
    cooldownDuplicate: 1, phaseConflict: 1, prohibitedAdvice: 1 });
  expect(summary.unpromptedCuesPerMinute).toBe(2);
});
