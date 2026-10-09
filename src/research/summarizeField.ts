export type FieldResult = { participantPseudonym: string; completion: "unassisted" | "rescued" | "incomplete" | "stopped";
  setupTimeSeconds: number; understanding: boolean; distraction: number; spokenQuerySuccess: boolean; bargeInSuccess: boolean;
  bystanderNotice: boolean; deletionSuccess: boolean; failureReason: string | null };
const rate = (rows: FieldResult[], predicate: (row: FieldResult) => boolean) => rows.length ? rows.filter(predicate).length / rows.length : 0;
export function summarizeField(rows: FieldResult[], options: { bootstrapIterations?: number; seed?: number } = {}) {
  const times = rows.map((row) => row.setupTimeSeconds).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const median = times.length ? times.length % 2 ? times[middle]! : (times[middle - 1]! + times[middle]!) / 2 : null;
  const failureReasons = rows.reduce<Record<string, number>>((all, row) => {
    if (row.failureReason) all[row.failureReason] = (all[row.failureReason] ?? 0) + 1;
    return all;
  }, {});
  const unassistedInterval95 = bootstrapInterval(rows, (row) => row.completion === "unassisted", options);
  return { sessions: rows.length, unassistedRate: rate(rows, (r) => r.completion === "unassisted"), rescueRate: rate(rows, (r) => r.completion === "rescued"),
    medianSetupTimeSeconds: median, understandingRate: rate(rows, (r) => r.understanding),
    spokenQuerySuccessRate: rate(rows, (r) => r.spokenQuerySuccess), bargeInSuccessRate: rate(rows, (r) => r.bargeInSuccess),
    bystanderComplianceRate: rate(rows, (r) => r.bystanderNotice), deletionSuccessRate: rate(rows, (r) => r.deletionSuccess),
    meanDistraction: rows.length ? rows.reduce((sum, row) => sum + row.distraction, 0) / rows.length : null,
    failureReasons, unassistedInterval95 };
}

function bootstrapInterval(rows: FieldResult[], predicate: (row: FieldResult) => boolean,
  options: { bootstrapIterations?: number; seed?: number }): [number, number] | [] {
  if (!rows.length) return [];
  let state = (options.seed ?? 20261009) >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
  const clusters = [...Map.groupBy(rows, (row) => row.participantPseudonym).values()];
  const values = Array.from({ length: options.bootstrapIterations ?? 10_000 }, () => {
    const sampled = Array.from({ length: clusters.length }, () => clusters[Math.floor(random() * clusters.length)]!).flat();
    return sampled.filter(predicate).length / sampled.length;
  }).sort((a, b) => a - b);
  return [values[Math.floor(values.length * 0.025)]!, values[Math.min(values.length - 1, Math.ceil(values.length * 0.975))]!];
}
