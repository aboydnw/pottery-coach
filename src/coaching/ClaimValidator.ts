import type { CueCandidate } from "./types";

export type ClaimValidation = { valid: boolean; violations: string[]; disableProactiveCloudSpeech: boolean };

const PROHIBITED = ["press harder", "too wet", "moisture", "thickness", "perfectly centered", "internally", "internal centering", "collapse"];

export function validateSpokenClaim(transcript: string, cue: CueCandidate, toolResults: Array<Record<string, unknown>>): ClaimValidation {
  const lower = transcript.toLowerCase();
  const violations: string[] = [];
  for (const phrase of PROHIBITED) if (lower.includes(phrase)) violations.push(`PROHIBITED:${phrase}`);
  const evidence = toolResults.filter((result) => cue.evidenceIds.includes(String(result.evidenceId ?? "")));
  const allowedMm = new Set<number>();
  for (const source of [cue.facts, ...evidence]) for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && /mm|height|width|radius|amplitude/i.test(key)) allowedMm.add(value);
  }
  const numericClaims = [...transcript.matchAll(/\b(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi)].map((match) => Number(match[1]) * (match[2]!.toLowerCase() === "cm" ? 10 : 1));
  for (const claim of numericClaims) {
    if (![...allowedMm].some((allowed) => Math.abs(allowed - claim) <= Math.max(0.5, Math.abs(allowed) * 0.01))) violations.push(`INVENTED_NUMBER:${claim}mm`);
  }
  return { valid: violations.length === 0, violations, disableProactiveCloudSpeech: violations.length > 0 };
}
