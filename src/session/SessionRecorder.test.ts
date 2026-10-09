import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { SessionRecorder } from "./SessionRecorder";
import { SessionRepository } from "./SessionRepository";
import type { SessionRecord } from "./types";

let repository: SessionRepository | undefined;
const session: SessionRecord = {
  id: "s", schemaVersion: 1, startedAtMs: 0, endedAtMs: null, goal: null,
  deviceClass: "phone", calibrationId: "c", outcome: null,
  consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false,
    snapshotUpload: false, researchMedia: false, policyRevision: "1", grantedAtMs: 0 },
};

afterEach(async () => repository?.destroy());

describe("SessionRecorder", () => {
  it("downsamples stable readings to 2 Hz and diagnostics to 1 Hz", async () => {
    repository = new SessionRepository(`test-${crypto.randomUUID()}`);
    await repository.create(session);
    const recorder = new SessionRecorder(repository, "s");

    recorder.recordReading({ id: "r1", sessionId: "s", timestampMs: 0, kind: "stable", values: { heightMm: 10 }, confidence: 0.9 });
    recorder.recordReading({ id: "r2", sessionId: "s", timestampMs: 100, kind: "stable", values: { heightMm: 11 }, confidence: 0.9 });
    recorder.recordReading({ id: "r3", sessionId: "s", timestampMs: 500, kind: "stable", values: { heightMm: 12 }, confidence: 0.9 });
    recorder.recordDiagnostic({ id: "d1", sessionId: "s", timestampMs: 0, values: { fps: 30 } });
    recorder.recordDiagnostic({ id: "d2", sessionId: "s", timestampMs: 500, values: { fps: 25 } });
    recorder.recordDiagnostic({ id: "d3", sessionId: "s", timestampMs: 1_000, values: { fps: 28 } });
    await recorder.flush();

    expect((await repository.get("s"))?.readings.map((item) => item.id)).toEqual(["r1", "r3"]);
    expect((await repository.get("s"))?.diagnostics.map((item) => item.id)).toEqual(["d1", "d3"]);
  });

  it("drops diagnostics before evidence when its bounded queue is full", async () => {
    repository = new SessionRepository(`test-${crypto.randomUUID()}`);
    await repository.create(session);
    const recorder = new SessionRecorder(repository, "s", { maxQueue: 2, autoFlush: false });
    recorder.recordDiagnostic({ id: "d1", sessionId: "s", timestampMs: 0, values: {} });
    recorder.recordDiagnostic({ id: "d2", sessionId: "s", timestampMs: 1_000, values: {} });
    recorder.recordEvent({ id: "e1", sessionId: "s", timestampMs: 2_000, type: "cue", evidenceIds: ["r1"], payload: {} });
    await recorder.flush();

    expect((await repository.get("s"))?.events.map((item) => item.id)).toEqual(["e1"]);
    expect((await repository.get("s"))?.diagnostics).toHaveLength(1);
    expect(recorder.dropped).toEqual({ diagnostic: 1, evidence: 0 });
  });

  it("continues ephemerally and discloses storage failure", async () => {
    const disclosures: string[] = [];
    const failing = {
      appendReading: async () => { throw new DOMException("full", "QuotaExceededError"); },
      appendDiagnostic: async () => undefined,
      appendEvent: async () => undefined,
    } as unknown as SessionRepository;
    const recorder = new SessionRecorder(failing, "s", { onStorageUnavailable: (reason) => disclosures.push(reason) });
    recorder.recordReading({ id: "r", sessionId: "s", timestampMs: 0, kind: "stable", values: {}, confidence: 0.9 });
    await recorder.flush();
    expect(recorder.storageAvailable).toBe(false);
    expect(disclosures).toEqual(["quota-exceeded"]);
  });
});
