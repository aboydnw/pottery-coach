import { readFile } from "node:fs/promises";
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/summarize-field.mjs results.json");
const rows = JSON.parse(await readFile(path, "utf8"));
const rate = (key, expected = true) => rows.length ? rows.filter((row) => row[key] === expected).length / rows.length : 0;
const values = rows.map((row) => row.setupTimeSeconds).sort((a, b) => a - b);
const mid = Math.floor(values.length / 2);
const median = values.length ? values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2 : null;
const failureReasons = rows.reduce((all, row) => { if (row.failureReason) all[row.failureReason] = (all[row.failureReason] ?? 0) + 1; return all; }, {});
const clusters = [...Map.groupBy(rows, (row) => row.participantPseudonym).values()];
let state = 20261009;
const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
const bootstrap = clusters.length ? Array.from({ length: 10_000 }, () => {
  const sample = Array.from({ length: clusters.length }, () => clusters[Math.floor(random() * clusters.length)]).flat();
  return sample.filter((row) => row.completion === "unassisted").length / sample.length;
}).sort((a, b) => a - b) : [];
console.log(JSON.stringify({ sessions: rows.length,
  unassistedRate: rows.length ? rows.filter((row) => row.completion === "unassisted").length / rows.length : 0,
  rescueRate: rows.length ? rows.filter((row) => row.completion === "rescued").length / rows.length : 0,
  medianSetupTimeSeconds: median, spokenQuerySuccessRate: rate("spokenQuerySuccess"), bargeInSuccessRate: rate("bargeInSuccess"),
  understandingRate: rate("understanding"), meanDistraction: rows.length ? rows.reduce((sum, row) => sum + row.distraction, 0) / rows.length : null,
  bystanderComplianceRate: rate("bystanderNotice"), deletionSuccessRate: rate("deletionSuccess"), failureReasons,
  unassistedInterval95: bootstrap.length ? [bootstrap[Math.floor(bootstrap.length * 0.025)], bootstrap[Math.ceil(bootstrap.length * 0.975)]] : [] }, null, 2));
