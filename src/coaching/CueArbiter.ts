import type { CueCandidate } from "./types";

type Context = { userSpeaking: boolean; activeShaping: boolean; occluded: boolean; approvedUrgentPolicies?: Set<string> };
type Suppressed = { cue: CueCandidate; reason: string };

export class CueArbiter {
  private lastGlobalSpokenAt = -Infinity;
  private lastPolicySpokenAt = new Map<string, number>();
  private spokenEvidence = new Set<string>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  consider(candidates: CueCandidate[], context: Context): { speak: CueCandidate | null; suppressed: Suppressed[] } {
    const ordered = [...candidates].sort((left, right) => left.priority - right.priority || left.createdAtMs - right.createdAtMs);
    const suppressed: Suppressed[] = [];
    let speak: CueCandidate | null = null;
    for (const cue of ordered) {
      const reason = this.suppressionReason(cue, context);
      if (reason || speak) suppressed.push({ cue, reason: reason ?? "LOWER_PRIORITY" });
      else speak = cue;
    }
    return { speak, suppressed };
  }

  markSpoken(cue: CueCandidate): void {
    const now = this.now(); this.lastGlobalSpokenAt = now; this.lastPolicySpokenAt.set(cue.policyId, now);
    cue.evidenceIds.forEach((id) => this.spokenEvidence.add(`${cue.policyId}:${id}`));
  }
  cancel(_cue: CueCandidate, _reason: string): void {}

  private suppressionReason(cue: CueCandidate, context: Context): string | null {
    const now = this.now();
    if (cue.expiresAtMs < now) return "EXPIRED";
    if (context.occluded) return "OCCLUDED";
    if (context.activeShaping && cue.priority > 1) return "ACTIVE_SHAPING";
    if (context.userSpeaking && !(cue.priority === 1 && context.approvedUrgentPolicies?.has(cue.policyId))) return "USER_SPEAKING";
    if (cue.evidenceIds.some((id) => this.spokenEvidence.has(`${cue.policyId}:${id}`))) return "DUPLICATE_EVIDENCE";
    if (cue.priority > 1 && now - this.lastGlobalSpokenAt < 20_000) return "GLOBAL_COOLDOWN";
    const policyCooldown = cue.priority === 5 ? 180_000 : 60_000;
    if (now - (this.lastPolicySpokenAt.get(cue.policyId) ?? -Infinity) < policyCooldown) return "POLICY_COOLDOWN";
    return null;
  }
}
