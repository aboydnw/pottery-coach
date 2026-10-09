import { expect, it } from "vitest";

import { evaluatePolicies } from "./evaluatePolicies";
import type { CuePolicy } from "./types";

const policy: CuePolicy & { enabled: boolean; mode: "proactive" } = { id: "regional", revision: 1, trigger: "target-deviation", requiredConfidence: 0.82, maxFreshnessMs: 500, minimumPersistenceMs: 2000, priority: 4, cooldownMs: 60000, suppressions: [], spokenExamples: ["wide"], prohibitedWording: [], auditEvent: "cue", instructorApprovalId: null, enabled: false, mode: "proactive" };

it("keeps unapproved proactive policies silent but permits eligible direct questions", () => {
  const observation = { kind: "target-deviation" as const, evidenceIds: ["p1"], confidence: 0.9, timestampMs: 1000, persistedMs: 3000, facts: { errorMm: 5 } };
  expect(evaluatePolicies(observation, [policy], 1200)).toEqual([]);
  expect(evaluatePolicies({ ...observation, directQuestion: true }, [policy], 1200)[0]?.priority).toBe(2);
  expect(evaluatePolicies({ ...observation, directQuestion: true, confidence: 0.81 }, [policy], 1200)).toEqual([]);
});
