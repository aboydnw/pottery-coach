import { expect, it } from "vitest";

import { CueArbiter } from "./CueArbiter";
import type { CueCandidate } from "./types";

const cue = (policyId: string, priority: CueCandidate["priority"], evidence = policyId): CueCandidate => ({ policyId, priority, createdAtMs: 1000, expiresAtMs: 100_000, evidenceIds: [evidence], facts: {} });

it("chooses highest priority and enforces global, same-policy, and duplicate-evidence cooldowns", () => {
  let now = 1000;
  const arbiter = new CueArbiter(() => now);
  let decision = arbiter.consider([cue("encourage", 5), cue("question", 2)], { userSpeaking: false, activeShaping: false, occluded: false });
  expect(decision.speak?.policyId).toBe("question");
  arbiter.markSpoken(decision.speak!);
  now += 10_000;
  decision = arbiter.consider([cue("correction", 4, "new")], { userSpeaking: false, activeShaping: false, occluded: false });
  expect(decision.speak).toBeNull(); expect(decision.suppressed[0]?.reason).toBe("GLOBAL_COOLDOWN");
  now += 60_000;
  decision = arbiter.consider([cue("question", 2)], { userSpeaking: false, activeShaping: false, occluded: false });
  expect(decision.suppressed[0]?.reason).toBe("DUPLICATE_EVIDENCE");
});

it("allows only approved priority-one cues to interrupt user speech", () => {
  const arbiter = new CueArbiter(() => 2000);
  const decision = arbiter.consider([cue("urgent", 1), cue("question", 2)], { userSpeaking: true, activeShaping: false, occluded: false, approvedUrgentPolicies: new Set(["urgent"]) });
  expect(decision.speak?.policyId).toBe("urgent");
  expect(decision.suppressed.some((item) => item.reason === "USER_SPEAKING")).toBe(true);
});
