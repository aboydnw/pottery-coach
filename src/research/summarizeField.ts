export type FieldResult = { participantPseudonym: string; completion: "unassisted" | "rescued" | "incomplete" | "stopped";
  setupTimeSeconds: number; understanding: boolean; distraction: number; spokenQuerySuccess: boolean; bargeInSuccess: boolean;
  bystanderNotice: boolean; deletionSuccess: boolean };
const rate = (rows: FieldResult[], predicate: (row: FieldResult) => boolean) => rows.length ? rows.filter(predicate).length / rows.length : 0;
export function summarizeField(rows: FieldResult[]) {
  const times = rows.map((row) => row.setupTimeSeconds).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const median = times.length ? times.length % 2 ? times[middle]! : (times[middle - 1]! + times[middle]!) / 2 : null;
  return { sessions: rows.length, unassistedRate: rate(rows, (r) => r.completion === "unassisted"), rescueRate: rate(rows, (r) => r.completion === "rescued"),
    medianSetupTimeSeconds: median, understandingRate: rate(rows, (r) => r.understanding),
    spokenQuerySuccessRate: rate(rows, (r) => r.spokenQuerySuccess), bargeInSuccessRate: rate(rows, (r) => r.bargeInSuccess),
    bystanderComplianceRate: rate(rows, (r) => r.bystanderNotice), deletionSuccessRate: rate(rows, (r) => r.deletionSuccess),
    meanDistraction: rows.length ? rows.reduce((sum, row) => sum + row.distraction, 0) / rows.length : null };
}
