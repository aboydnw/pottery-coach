import { expect, it } from "vitest";

import { TranscriptStore } from "./TranscriptStore";

it("keeps partial transcripts memory-only and persists finals only with consent", () => {
  const storage = new Map<string, string>();
  const adapter = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } } as Storage;
  const store = new TranscriptStore(adapter, false);
  store.add({ eventId: "e1", speaker: "user", text: "hel", timestampMs: 1, final: false });
  expect(storage.size).toBe(0);
  store.setRetentionConsent(true);
  store.add({ eventId: "e1", speaker: "user", text: "hello", timestampMs: 2, final: true });
  expect(storage.size).toBe(1);
  store.setRetentionConsent(false);
  expect(storage.size).toBe(0);
});
