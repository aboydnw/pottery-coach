import { expect, it, vi } from "vitest";
import { BrowserCacheDeletion, LocalStorageSyncQueueDeletion } from "./localDeletion";

it("deletes only caches scoped to the session", async () => {
  const remove = vi.fn(async () => true);
  const adapter = new BrowserCacheDeletion({ keys: async () => ["app-shell", "pottery-coach-session-s"], delete: remove } as unknown as CacheStorage);
  expect(await adapter.deleteSession("s")).toBe(true);
  expect(remove).toHaveBeenCalledWith("pottery-coach-session-s");
  expect(remove).not.toHaveBeenCalledWith("app-shell");
});

it("removes a session from the local sync queue", async () => {
  localStorage.setItem("pottery-coach-sync-queue", JSON.stringify([{ sessionId: "s" }, { sessionId: "other" }]));
  expect(await new LocalStorageSyncQueueDeletion(localStorage).deleteSession("s")).toBe(true);
  expect(localStorage.getItem("pottery-coach-sync-queue")).toContain("other");
  expect(localStorage.getItem("pottery-coach-sync-queue")).not.toContain('"s"');
});
