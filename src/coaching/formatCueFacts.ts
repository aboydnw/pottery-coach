import type { CueCandidate } from "./types";

export type ApprovedUtteranceInput = { policyId: string; evidenceIds: string[]; facts: Readonly<Record<string, string | number | boolean | null>>; instruction: string };

export function formatCueFacts(candidate: CueCandidate): ApprovedUtteranceInput {
  if (candidate.evidenceIds.length === 0) throw new Error("A cue cannot be phrased without evidence");
  return {
    policyId: candidate.policyId,
    evidenceIds: [...candidate.evidenceIds],
    facts: Object.freeze({ ...candidate.facts }),
    instruction: "Phrase only these immutable facts. Do not introduce numbers, causes, or technique claims.",
  };
}
