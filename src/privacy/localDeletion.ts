export class BrowserCacheDeletion {
  constructor(private storage: CacheStorage) {}
  async deleteSession(sessionId: string) {
    const target = `pottery-coach-session-${sessionId}`;
    const present = (await this.storage.keys()).includes(target);
    return present ? this.storage.delete(target) : false;
  }
}

export class LocalStorageSyncQueueDeletion {
  constructor(private storage: Storage, private key = "pottery-coach-sync-queue") {}
  async deleteSession(sessionId: string) {
    const raw = this.storage.getItem(this.key);
    if (!raw) return false;
    try {
      const queue = JSON.parse(raw) as Array<{ sessionId?: string }>;
      const filtered = queue.filter((item) => item.sessionId !== sessionId);
      if (filtered.length === queue.length) return false;
      this.storage.setItem(this.key, JSON.stringify(filtered));
      return true;
    } catch { this.storage.removeItem(this.key); return true; }
  }
}
