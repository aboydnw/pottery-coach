import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/calibration/board-v1.svg", import.meta.url), "utf8");
const required = [
  'width="210mm"',
  'height="148mm"',
  'data-revision="board-v1"',
  'data-checksum="PC-B1-100MM"',
  'data-reference-mm="100"',
  "tagStandard41h12",
];
const missing = required.filter((token) => !source.includes(token));
const tagIds = [...source.matchAll(/41h12:(\d)/g)].map((match) => match[1]);
if (missing.length > 0 || new Set(tagIds).size !== 4) {
  throw new Error(`board-v1 invalid: missing ${missing.join(", ") || "four unique tags"}`);
}
process.stdout.write("board-v1: valid, 100.0 mm reference\n");
