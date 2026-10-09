import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { DeletionService } from "./DeletionService";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionRecord } from "../session/types";

let repository: SessionRepository;
afterEach(async () => repository?.destroy());

it("is idempotent and inventories unavailable provider deletion honestly", async () => {
  repository = new SessionRepository(`test-${crypto.randomUUID()}`);
  await repository.create({ id: "s", schemaVersion: 1, startedAtMs: 0, endedAtMs: 1, goal: null,
    deviceClass: "phone", calibrationId: null, outcome: "completed",
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false, snapshotUpload: false,
      researchMedia: false, policyRevision: "1", grantedAtMs: 0 } } as SessionRecord);
  const service = new DeletionService(repository, { now: () => 10 });
  const receipt = await service.deleteSession("s");
  expect(receipt.stores).toContainEqual({ name: "provider-exception", status: "provider-exception" });
  expect((await service.deleteSession("s")).stores[0]?.status).toBe("not-present");
});

it("cleans cache and sync queue and reports a backend failure for retry", async () => {
  repository = new SessionRepository(`test-${crypto.randomUUID()}`);
  await repository.create({ id: "s", schemaVersion: 1, startedAtMs: 0, endedAtMs: 1, goal: null,
    deviceClass: "phone", calibrationId: null, outcome: "completed",
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false, snapshotUpload: false,
      researchMedia: false, policyRevision: "1", grantedAtMs: 0 } } as SessionRecord);
  const cleaned: string[] = [];
  const service = new DeletionService(repository, { cache: { deleteSession: async (id) => { cleaned.push(`cache:${id}`); return true; } },
    syncQueue: { deleteSession: async (id) => { cleaned.push(`queue:${id}`); return true; } },
    backend: { deleteSession: async () => { throw new Error("offline"); } } });
  const receipt = await service.deleteSession("s");
  expect(cleaned).toEqual(["cache:s", "queue:s"]);
  expect(receipt.stores).toEqual(expect.arrayContaining([
    { name: "cache-storage", status: "deleted" }, { name: "sync-queue", status: "deleted" },
    { name: "backend", status: "provider-exception" },
  ]));
});

it("retries provider deletion idempotently after a partial failure", async () => {
  repository = new SessionRepository(`test-${crypto.randomUUID()}`);
  let attempts = 0;
  const service = new DeletionService(repository, { backend: { deleteSession: async () => { attempts++; if (attempts === 1) throw new Error("offline"); } } });
  expect((await service.deleteSession("missing")).stores).toContainEqual({ name: "backend", status: "provider-exception" });
  expect((await service.deleteSession("missing")).stores).toContainEqual({ name: "backend", status: "deleted" });
  expect(attempts).toBe(2);
});
