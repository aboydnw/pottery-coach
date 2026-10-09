export type TranscriptEntry = {
  eventId: string;
  speaker: "user" | "assistant";
  text: string;
  timestampMs: number;
  final: boolean;
};

const STORAGE_KEY = "pottery-coach-transcript-v1";

export class TranscriptStore {
  private entries = new Map<string, TranscriptEntry>();

  constructor(private readonly storage: Storage, private retentionConsent: boolean) {}

  add(entry: TranscriptEntry): void {
    this.entries.set(entry.eventId, { ...entry });
    if (entry.final && this.retentionConsent) this.persist();
  }

  list(): TranscriptEntry[] {
    return [...this.entries.values()].sort((left, right) => left.timestampMs - right.timestampMs).map((entry) => ({ ...entry }));
  }

  setRetentionConsent(consented: boolean): void {
    this.retentionConsent = consented;
    if (consented) this.persist();
    else this.storage.removeItem(STORAGE_KEY);
  }

  clear(): void {
    this.entries.clear();
    this.storage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    const finalEntries = this.list().filter((entry) => entry.final);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(finalEntries));
  }
}
