import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { RetentionService } from "./RetentionService";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionRecord } from "../session/types";

let repository: SessionRepository;
function session(id: string, startedAtMs: number, active = false): SessionRecord {
  return { id, schemaVersion: 1, startedAtMs, endedAtMs: active ? null : startedAtMs + 1,
    goal: null, deviceClass: "phone", calibrationId: null, outcome: active ? null : "completed",
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false, snapshotUpload: false,
      researchMedia: false, policyRevision: "1", grantedAtMs: startedAtMs } };
}
afterEach(async () => repository?.destroy());

it("expires sessions at the 30-day boundary but excludes active sessions", async () => {
  repository = new SessionRepository(`test-${crypto.randomUUID()}`);
  const day = 86_400_000;
  await repository.create(session("old", 0));
  await repository.create(session("active", 0, true));
  await new RetentionService(repository).expire(30 * day);
  expect(await repository.get("old")).toBeUndefined();
  expect(await repository.get("active")).toBeDefined();
});
