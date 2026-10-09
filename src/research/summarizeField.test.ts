import { expect, it } from "vitest";
import { summarizeField } from "./summarizeField";

it("reports completion, rescue, setup, comprehension and privacy outcomes", () => {
  const result = summarizeField([
    { participantPseudonym: "p1", completion: "unassisted", setupTimeSeconds: 60, understanding: true, distraction: 2, spokenQuerySuccess: true, bargeInSuccess: true, bystanderNotice: true, deletionSuccess: true, failureReason: null },
    { participantPseudonym: "p2", completion: "rescued", setupTimeSeconds: 120, understanding: false, distraction: 4, spokenQuerySuccess: false, bargeInSuccess: true, bystanderNotice: true, deletionSuccess: true, failureReason: "calibration" },
  ], { bootstrapIterations: 100, seed: 42 });
  expect(result).toMatchObject({ sessions: 2, unassistedRate: 0.5, rescueRate: 0.5, medianSetupTimeSeconds: 90,
    understandingRate: 0.5, spokenQuerySuccessRate: 0.5, bargeInSuccessRate: 1, bystanderComplianceRate: 1, deletionSuccessRate: 1 });
  expect(result.failureReasons).toEqual({ calibration: 1 });
  expect(result.unassistedInterval95).toHaveLength(2);
});
