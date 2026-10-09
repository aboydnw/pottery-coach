import type { SessionRecord } from "./types";

export function migratePreV1(input: Record<string, unknown>): SessionRecord {
  return {
    id: String(input.id), schemaVersion: 1,
    startedAtMs: Number(input.startedAtMs ?? input.startedAt ?? 0),
    endedAtMs: typeof input.endedAtMs === "number" ? input.endedAtMs : null,
    goal: null, deviceClass: String(input.deviceClass ?? "unknown"), calibrationId: null,
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false,
      snapshotUpload: false, researchMedia: false, policyRevision: "pre-v1", grantedAtMs: 0 },
    outcome: null,
  };
}
