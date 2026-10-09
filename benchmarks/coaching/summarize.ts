export type CoachingResult = { inventedMeasurement: boolean; staleClaim: boolean; lowConfidenceClaim: boolean;
  cooldownDuplicate: boolean; phaseConflict: boolean; prohibitedAdvice: boolean; unpromptedCue: boolean; durationMinutes: number };
export function summarizeCoaching(rows: CoachingResult[]) {
  const keys = ["inventedMeasurement", "staleClaim", "lowConfidenceClaim", "cooldownDuplicate", "phaseConflict", "prohibitedAdvice"] as const;
  const violations = Object.fromEntries(keys.map((key) => [key, rows.filter((row) => row[key]).length])) as Record<typeof keys[number], number>;
  const minutes = rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  const unprompted = rows.filter((row) => row.unpromptedCue).length;
  return { violations, pass: Object.values(violations).every((count) => count === 0),
    unpromptedCuesPerMinute: minutes ? unprompted / minutes : 0 };
}
