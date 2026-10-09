import { readFile } from "node:fs/promises";
const device = JSON.parse(await readFile(new URL("../research/field/device-matrix.json", import.meta.url)));
const studio = JSON.parse(await readFile(new URL("../research/field/studio-matrix.json", import.meta.url)));
for (const [name, data] of [["device", device], ["studio", studio]]) {
  if (!data.status || !Array.isArray(data.completed) || !Array.isArray(data.consentRevisions) || !data.consentRevisions.length)
    throw new Error(`${name} matrix is malformed or lacks consent references`);
}
if (device.requiredClasses.length < 5 || device.requiredClasses.filter((item) => /iPhone/.test(item)).length < 2
  || device.requiredClasses.filter((item) => /Android/.test(item)).length < 2 || !device.requiredClasses.some((item) => /desktop/.test(item)))
  throw new Error("Device matrix does not preregister the required phone classes and desktop control");
for (const light of ["diffuse", "side", "shadow", "brightness-change"]) if (!studio.lights.includes(light)) throw new Error(`Missing light condition: ${light}`);
for (const condition of ["wet", "dry"]) if (!studio.wetness.includes(condition)) throw new Error(`Missing wetness condition: ${condition}`);
for (const item of ["hands", "tools", "sponge", "clutter"]) if (!studio.occlusions.includes(item)) throw new Error(`Missing occlusion condition: ${item}`);
if (studio.clayColorsRequired < 4 || studio.backdropsRequired < 3) throw new Error("Studio matrix is below preregistered clay/backdrop coverage");
if (process.argv.includes("--require-complete") && (device.completed.length < device.requiredClasses.length || studio.completed.length === 0))
  throw new Error("Physical field matrix remains incomplete");
console.log("Field manifests are structurally valid; physical completion status:", device.status, studio.status);
