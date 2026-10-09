import { readFile } from "node:fs/promises";
const device = JSON.parse(await readFile(new URL("../research/field/device-matrix.json", import.meta.url)));
const studio = JSON.parse(await readFile(new URL("../research/field/studio-matrix.json", import.meta.url)));
for (const [name, data] of [["device", device], ["studio", studio]]) {
  if (!data.status || !Array.isArray(data.completed)) throw new Error(`${name} matrix is malformed`);
}
console.log("Field manifests are structurally valid; physical completion status:", device.status, studio.status);
