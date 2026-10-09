import { z } from "zod";

export const cuePolicySchema = z.object({
  id: z.string().min(1), revision: z.number().int().positive(), trigger: z.string().min(1),
  requiredConfidence: z.number().min(0).max(1), maxFreshnessMs: z.number().nonnegative(),
  minimumPersistenceMs: z.number().nonnegative(), priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  cooldownMs: z.number().nonnegative(), suppressions: z.array(z.string()), spokenExamples: z.array(z.string()).min(1),
  prohibitedWording: z.array(z.string()), auditEvent: z.string().min(1), instructorApprovalId: z.string().min(1).nullable(),
  mode: z.enum(["reactive", "proactive"]), enabled: z.boolean(),
}).transform((policy) => ({ ...policy, enabled: policy.mode === "proactive" && !policy.instructorApprovalId ? false : policy.enabled }));
