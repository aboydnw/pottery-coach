import type { SessionRepository } from "../session/SessionRepository";
import type { DeletionReceipt } from "../session/types";

export type BackendDeletion = { deleteSession(id: string): Promise<void> };
export type LocalDeletion = { deleteSession(id: string): Promise<boolean> };
export class DeletionService {
  constructor(private repository: SessionRepository,
    private options: { now?: () => number; backend?: BackendDeletion; stopMedia?: () => Promise<void>;
      cache?: LocalDeletion; syncQueue?: LocalDeletion } = {}) {}
  async deleteSession(sessionId: string): Promise<DeletionReceipt> {
    const now = this.options.now ?? Date.now;
    const requestedAtMs = now();
    await this.options.stopMedia?.();
    const deleted = await this.repository.delete(sessionId);
    const cacheDeleted = await this.options.cache?.deleteSession(sessionId) ?? false;
    const queueDeleted = await this.options.syncQueue?.deleteSession(sessionId) ?? false;
    const stores: DeletionReceipt["stores"] = [
      { name: "indexeddb", status: deleted ? "deleted" : "not-present" },
      { name: "cache-storage", status: cacheDeleted ? "deleted" : "not-present" },
      { name: "local-blobs", status: deleted ? "deleted" : "not-present" },
      { name: "sync-queue", status: queueDeleted ? "deleted" : "not-present" },
    ];
    if (this.options.backend) {
      try { await this.options.backend.deleteSession(sessionId); stores.push({ name: "backend", status: "deleted" }); }
      catch { stores.push({ name: "backend", status: "provider-exception" }); }
    } else stores.push({ name: "provider-exception", status: "provider-exception" });
    return { sessionId, requestedAtMs, completedAtMs: now(), stores };
  }
}
