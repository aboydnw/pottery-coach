import type { CueCandidate, CuePolicy } from "./types";

export type CoachingObservation = {
  kind: "measurement-unavailable" | "current-dimensions" | "target-deviation" | "target-milestone" | "visible-oscillation" | "session-control";
  evidenceIds: string[]; confidence: number; timestampMs: number; persistedMs: number;
  facts: CueCandidate["facts"]; directQuestion?: boolean; occluded?: boolean; activeShaping?: boolean;
};

export function evaluatePolicies(observation: CoachingObservation, policies: Array<CuePolicy & { enabled?: boolean; mode?: "reactive" | "proactive" }>, now: number): CueCandidate[] {
  return policies.filter((policy) => policy.trigger === observation.kind)
    .filter((policy) => observation.directQuestion ? true : policy.enabled === true)
    .filter((policy) => observation.confidence >= policy.requiredConfidence && now - observation.timestampMs <= policy.maxFreshnessMs && observation.persistedMs >= policy.minimumPersistenceMs)
    .filter(() => !observation.occluded && !observation.activeShaping)
    .map((policy) => ({ policyId: policy.id, createdAtMs: now, expiresAtMs: observation.timestampMs + policy.maxFreshnessMs, evidenceIds: [...observation.evidenceIds], facts: Object.freeze({ ...observation.facts }), priority: observation.directQuestion ? 2 : policy.priority }));
}
