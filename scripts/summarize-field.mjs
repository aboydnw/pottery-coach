import { readFile } from "node:fs/promises";
const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/summarize-field.mjs results.json");
const rows = JSON.parse(await readFile(path, "utf8"));
const values = rows.map((row) => row.setupTimeSeconds).sort((a, b) => a - b);
const unassisted = rows.filter((row) => row.completion === "unassisted").length;
console.log(JSON.stringify({ sessions: rows.length, unassistedRate: rows.length ? unassisted / rows.length : 0,
  medianSetupTimeSeconds: values.length ? values[Math.floor(values.length / 2)] : null }, null, 2));
