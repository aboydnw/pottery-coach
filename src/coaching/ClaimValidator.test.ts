import { expect, it } from "vitest";

import { validateSpokenClaim } from "./ClaimValidator";
import type { CueCandidate } from "./types";

const cue: CueCandidate = { policyId: "height", createdAtMs: 0, expiresAtMs: 1000, evidenceIds: ["r1"], facts: { heightMm: 123.4 }, priority: 2 };

it("accepts grounded rounding and permitted visual-centering language", () => {
  expect(validateSpokenClaim("Height is about 12.3 cm and it looks visually centered from this view.", cue, [{ evidenceId: "r1", heightMm: 123.4 }]).valid).toBe(true);
});

it.each(["It is 17 cm tall", "Press harder because the clay is too wet", "The walls are perfectly centered internally", "It will collapse soon"])("rejects invented or prohibited claim: %s", (transcript) => {
  expect(validateSpokenClaim(transcript, cue, [{ evidenceId: "r1", heightMm: 123.4 }]).valid).toBe(false);
});

it("rejects a number backed only by stale or low-confidence tool evidence", () => {
  const result = validateSpokenClaim("Height is 123.4 mm", cue,
    [{ evidenceId: "r1", heightMm: 123.4, measurable: false, reason: "LOW_CONFIDENCE", confidence: 0.5, freshnessMs: 100 }]);
  expect(result.valid).toBe(false);
  expect(result.violations).toContain("INELIGIBLE_EVIDENCE:r1");
});
