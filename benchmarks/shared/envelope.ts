import { createHash } from "node:crypto";

type Input = { benchmarkVersion: string; fixtureId: string; metrics: Record<string, number | null>; exclusions: string[];
  unmeasurableCount: number; artifactChecksums: string[]; config: Record<string, unknown>;
  environment?: { commit?: string; startedAt?: string; device?: string; os?: string; browser?: string } };

export function checksum(value: string | Uint8Array) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }

export function buildBenchmarkRun(input: Input) {
  return { benchmarkVersion: input.benchmarkVersion, commit: input.environment?.commit ?? process.env.GIT_COMMIT ?? "uncommitted",
    fixtureId: input.fixtureId, startedAt: input.environment?.startedAt ?? new Date().toISOString(),
    device: input.environment?.device ?? "synthetic", os: input.environment?.os ?? `${process.platform}-${process.arch}`,
    browser: input.environment?.browser ?? "none", configHash: checksum(JSON.stringify(input.config)), metrics: input.metrics,
    exclusions: [...input.exclusions], unmeasurableCount: input.unmeasurableCount, artifactChecksums: [...input.artifactChecksums] };
}
