import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { SessionRepository } from "./SessionRepository";
import type { SessionRecord } from "./types";

const databases: SessionRepository[] = [];

function record(id = "session-1"): SessionRecord {
  return {
    id,
    schemaVersion: 1,
    startedAtMs: 1_000,
    endedAtMs: null,
    goal: null,
    deviceClass: "phone",
    calibrationId: null,
    consent: {
      cameraLocal: true,
      cloudAudio: false,
      transcriptRetention: false,
      snapshotUpload: false,
      researchMedia: false,
      policyRevision: "2026-10-09",
      grantedAtMs: 900,
    },
    outcome: null,
  };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((repository) => repository.destroy()));
});

describe("SessionRepository", () => {
  it("stores a versioned session without raw media fields", async () => {
    const repository = new SessionRepository(`test-${crypto.randomUUID()}`);
    databases.push(repository);
    await repository.create(record());

    const stored = await repository.get("session-1");
    expect(stored?.session.schemaVersion).toBe(1);
    expect(JSON.stringify(stored)).not.toMatch(/raw(Video|Audio)|mediaStream/i);
  });

  it("rolls back an event append when its session does not exist", async () => {
    const repository = new SessionRepository(`test-${crypto.randomUUID()}`);
    databases.push(repository);

    await expect(repository.appendEvent({
      id: "event-1", sessionId: "missing", timestampMs: 2_000,
      type: "cue", evidenceIds: [], payload: {},
    })).rejects.toThrow(/session/i);
    expect(await repository.listEvents("missing")).toEqual([]);
  });

  it("enforces transcript and still consent independently", async () => {
    const repository = new SessionRepository(`test-${crypto.randomUUID()}`);
    databases.push(repository);
    await repository.create(record());

    await expect(repository.appendTranscript("session-1", "hello", 2_000)).rejects.toThrow(/transcript/i);
    await expect(repository.markMoment({
      id: "moment-1", sessionId: "session-1", timestampMs: 2_000,
      label: "rim", stillBlobId: "blob-1", localOnly: false,
    }, new Blob(["still"]))).rejects.toThrow(/snapshot/i);
  });

  it("expires ended records at the boundary while preserving active sessions", async () => {
    const repository = new SessionRepository(`test-${crypto.randomUUID()}`); databases.push(repository);
    await repository.create({ ...record("old"), startedAtMs: 0, endedAtMs: 0, outcome: "completed" });
    await repository.create({ ...record("recently-ended"), startedAtMs: 0, endedAtMs: 30 * 86_400_000 - 1, outcome: "completed" });
    await repository.create({ ...record("active"), startedAtMs: 0 });
    expect(await repository.expire(30 * 86_400_000, 30 * 86_400_000)).toEqual(["old"]);
    expect(await repository.get("active")).toBeDefined();
    expect(await repository.get("recently-ended")).toBeDefined();
  });
});
