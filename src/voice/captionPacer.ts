import type { Caption } from "./useVoiceSession";

/** Roughly how fast the coach's voice speaks (about 160 words a minute). */
export const WORDS_PER_SECOND = 2.7;
/** If the provider never says the audio started, start revealing anyway after this long. */
export const START_FALLBACK_MS = 1_500;

type Entry = {
  caption: Caption;
  createdAtMs: number;
  startedAtMs: number | null;
  /** The audio finished: show everything. */
  complete: boolean;
  /** The coach was interrupted: show only the words that were spoken. */
  frozenWords: number | null;
};

/**
 * Times the coach's captions to its voice. The provider sends the transcript faster than the audio
 * plays, so assistant words are revealed at speaking pace from when the audio starts, and in full
 * once it stops. The potter's own words are shown as they arrive.
 */
export class CaptionPacer {
  private entries: Entry[] = [];
  private audioPlaying = false;

  constructor(private readonly maxCaptions: number) {}

  update(caption: Caption, nowMs: number): void {
    const existing = this.entries.find((entry) => entry.caption.id === caption.id);
    if (existing) {
      existing.caption = caption;
      return;
    }
    this.entries.push({
      caption,
      createdAtMs: nowMs,
      startedAtMs: this.audioPlaying ? nowMs : null,
      complete: caption.speaker === "user",
      frozenWords: null,
    });
    this.entries = this.entries.slice(-this.maxCaptions);
  }

  audioStarted(nowMs: number): void {
    this.audioPlaying = true;
    for (const entry of this.pending()) entry.startedAtMs ??= nowMs;
  }

  audioStopped(nowMs: number, interrupted: boolean): void {
    this.audioPlaying = false;
    for (const entry of this.pending()) {
      if (interrupted) entry.frozenWords = this.revealedWords(entry, nowMs);
      entry.complete = true;
    }
  }

  /** True while some caption is still being revealed, so the caller knows to keep ticking. */
  isRevealing(): boolean {
    return this.pending().length > 0;
  }

  visible(nowMs: number): Caption[] {
    return this.entries.flatMap((entry) => {
      const words = entry.caption.text.split(/\s+/).filter(Boolean);
      const count =
        entry.frozenWords ?? (entry.complete ? words.length : Math.min(words.length, this.revealedWords(entry, nowMs)));
      return count > 0 ? [{ ...entry.caption, text: words.slice(0, count).join(" ") }] : [];
    });
  }

  private pending(): Entry[] {
    return this.entries.filter((entry) => !entry.complete);
  }

  private revealedWords(entry: Entry, nowMs: number): number {
    const startedAtMs =
      entry.startedAtMs ??
      (nowMs - entry.createdAtMs >= START_FALLBACK_MS ? entry.createdAtMs + START_FALLBACK_MS : null);
    if (startedAtMs === null) return 0;
    return Math.floor(((nowMs - startedAtMs) / 1000) * WORDS_PER_SECOND) + 1;
  }
}
