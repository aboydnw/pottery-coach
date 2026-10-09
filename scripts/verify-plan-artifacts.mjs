import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "benchmarks/shared/result.schema.json",
  "benchmarks/dimensions/manifest.schema.json", "benchmarks/dimensions/run.ts", "benchmarks/dimensions/summarize.ts",
  "benchmarks/segmentation/manifest.schema.json", "benchmarks/segmentation/run.ts", "benchmarks/segmentation/summarize.ts",
  "benchmarks/profile/generate.ts", "benchmarks/profile/summarize.ts", "benchmarks/wobble/manifest.schema.json",
  "benchmarks/wobble/generate.ts", "benchmarks/wobble/run.ts", "benchmarks/wobble/summarize.ts",
  "benchmarks/voice/scripts.json", "benchmarks/voice/run.ts", "benchmarks/voice/summarize.ts",
  "benchmarks/coaching/scenarios/scenarios.json", "benchmarks/coaching/run.ts", "benchmarks/coaching/summarize.ts",
  "benchmarks/integrated/result.schema.json", "benchmarks/integrated/run.ts", "benchmarks/integrated/summarize.ts",
  "src/app/AppSessionOrchestrator.ts", "src/app/routes.tsx", "src/release/manifest.ts",
  "tests/e2e/cylinder-flow.spec.ts", "tests/e2e/template-flow.spec.ts", "tests/e2e/degraded-flow.spec.ts",
  "tests/e2e/network-boundary.spec.ts", "tests/e2e/memory-soak.spec.ts", "tests/e2e/privacy-field.spec.ts",
  "docs/calibration-fixture-protocol.md", "docs/wobble-rig-protocol.md", "docs/voice-test-protocol.md",
  "docs/integrated-test-protocol.md", "docs/release-checklist.md", "docs/privacy-notice.md",
  "docs/implementation-audit.md", "public/health.json",
  "docs/session-data.md",
  "docs/coaching-policy.md",
  "research/field/protocol.md", "research/field/manifest.schema.json", "research/field/device-matrix.json",
];

for (const path of required) await access(resolve(path));
for (const path of required.filter((path) => path.endsWith(".json"))) JSON.parse(await readFile(resolve(path), "utf8"));

const linkedDocuments = ["docs/release-checklist.md", "docs/reviews/field-release-review.md", "docs/research/10-benchmark-results.md"];
for (const document of linkedDocuments) {
  const content = await readFile(resolve(document), "utf8");
  for (const match of content.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) {
    const target = resolve(document, "..", decodeURIComponent(match[1]).split("#")[0]);
    await access(target).catch(() => { throw new Error(`${document} has an unresolved link: ${match[1]}`); });
  }
}
const artifactDirectories = ["dimensions", "segmentation", "wobble", "voice", "coaching", "integrated"];
let artifactCount = 0;
for (const name of artifactDirectories) {
  const directory = resolve("benchmarks", name, "artifacts");
  const files = await readdir(directory);
  if (!files.length) throw new Error(`${name} has no benchmark artifact`);
  for (const file of files) {
    const content = await readFile(resolve(directory, file), "utf8");
    const rows = file.endsWith(".jsonl") ? content.trim().split("\n").map(JSON.parse) : [JSON.parse(content)];
    for (const row of rows) {
      for (const field of ["benchmarkVersion", "commit", "fixtureId", "startedAt", "device", "os", "browser", "configHash", "metrics", "exclusions", "unmeasurableCount", "artifactChecksums"])
        if (!(field in row)) throw new Error(`${name}/${file} lacks ${field}`);
      if (!String(row.configHash).startsWith("sha256:") || !row.artifactChecksums.every((value) => String(value).startsWith("sha256:")))
        throw new Error(`${name}/${file} has invalid checksums`);
      artifactCount++;
    }
  }
}
console.log(`Verified ${required.length} required plan artifacts, local evidence links, and ${artifactCount} benchmark records.`);
