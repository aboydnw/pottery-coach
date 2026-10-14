import { readFile } from "node:fs/promises";
import { summarizeField, type FieldResult } from "../src/research/summarizeField";

const path = process.argv[2];
if (!path) throw new Error("Usage: pnpm research:summarize-field results.json");
const rows = JSON.parse(await readFile(path, "utf8")) as FieldResult[];
console.log(JSON.stringify(summarizeField(rows), null, 2));
