import { expect, it } from "vitest";
import { buildBenchmarkRun } from "./envelope";

it("emits the complete immutable benchmark provenance envelope", () => {
  const run = buildBenchmarkRun({ benchmarkVersion: "dimensions-v1", fixtureId: "f1", metrics: { errorMm: 2 },
    exclusions: [], unmeasurableCount: 0, artifactChecksums: ["sha256:abc"], config: { threshold: 5 },
    environment: { commit: "abc", startedAt: "2026-10-09T00:00:00.000Z", device: "synthetic", os: "node", browser: "none" } });
  expect(run).toMatchObject({ benchmarkVersion: "dimensions-v1", commit: "abc", fixtureId: "f1",
    startedAt: "2026-10-09T00:00:00.000Z", device: "synthetic", os: "node", browser: "none",
    metrics: { errorMm: 2 }, exclusions: [], unmeasurableCount: 0, artifactChecksums: ["sha256:abc"] });
  expect(run.configHash).toMatch(/^sha256:/);
});
