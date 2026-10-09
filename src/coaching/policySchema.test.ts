import { expect, it } from "vitest";

import { cuePolicySchema } from "./policySchema";

it("disables unapproved proactive policies and requires the full audit contract", () => {
  const policy = { id: "regional", revision: 1, trigger: "regional-error", requiredConfidence: 0.82, maxFreshnessMs: 500, minimumPersistenceMs: 2000, priority: 4, cooldownMs: 60000, suppressions: ["occluded"], spokenExamples: ["The upper body is wide."], prohibitedWording: ["press harder"], auditEvent: "regional-cue", instructorApprovalId: null, mode: "proactive", enabled: true };
  expect(cuePolicySchema.parse(policy).enabled).toBe(false);
  const { auditEvent: _, ...missing } = policy;
  expect(cuePolicySchema.safeParse(missing).success).toBe(false);
});
