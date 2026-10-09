export type ThrowingPhase = "setup" | "centering" | "opening" | "raising-walls" | "shaping" | "finishing" | "session-ended" | "uncertain";
export type PhaseEvidence = { phase: ThrowingPhase; confidence: number; source: "initial" | "user" | "shape" | "contradiction" | "expired" | "session"; timestampMs: number; reasons: string[] };
export type PhaseEvent =
  | { type: "user-declared"; phase: Exclude<ThrowingPhase, "session-ended" | "uncertain"> }
  | { type: "shape-corroboration"; phase: Exclude<ThrowingPhase, "session-ended" | "uncertain">; confidence: number }
  | { type: "contradiction"; reason: string }
  | { type: "expired" }
  | { type: "session-ended" };
export type CuePriority = 1 | 2 | 3 | 4 | 5 | 6;
export type CuePolicy = { id: string; revision: number; trigger: string; requiredConfidence: number; maxFreshnessMs: number; minimumPersistenceMs: number; priority: CuePriority; cooldownMs: number; suppressions: string[]; spokenExamples: string[]; prohibitedWording: string[]; auditEvent: string; instructorApprovalId: string | null };
export type CueCandidate = { policyId: string; createdAtMs: number; expiresAtMs: number; evidenceIds: string[]; facts: Readonly<Record<string, string | number | boolean | null>>; priority: CuePriority };
