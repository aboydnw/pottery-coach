import type { ProviderUsage } from "../voice/types";

export type CueVerdict = "helpful" | "wrong" | "not-now";

/** "It's actually 14.5 cm": what the potter measured next to what the app read at that moment. */
export type SizeCorrection = {
  atMs: number;
  dimension: "height" | "width";
  trueMm: number;
  appMm: number | null;
  confidence: number | null;
  handsLikely: boolean;
};

export type LoggedCue = { atMs: number; policyId: string; text: string; verdict?: CueVerdict };
export type PieceNote = { atMs: number; text: string };

/** Fields every synced record carries. `syncedAtMs` older than `updatedAtMs` means it still needs pushing. */
export type Syncable = { updatedAtMs: number; syncedAtMs: number | null; deleted?: boolean };

/** One pot: a permanent throw-log entry, kept after the detailed session recording expires. */
export type PieceRecord = Syncable & {
  id: string;
  sessionId: string;
  /** 1 for the first piece of a session, 2 for the next, and so on. */
  index: number;
  startedAtMs: number;
  endedAtMs: number | null;
  targetId: string | null;
  goalHeightMm: number | null;
  goalBasis: "wet" | "fired" | null;
  sizesAvailable: boolean;
  peakHeightMm: number | null;
  finalHeightMm: number | null;
  finalMaximumWidthMm: number | null;
  reachedGoalPercent: number | null;
  markedMoments: number;
  notes: PieceNote[];
  corrections: SizeCorrection[];
  cues: LoggedCue[];
  usage: ProviderUsage;
  estimatedCostUsd: number;
};

/** Something the coach should remember about the potter across sessions. */
export type LastingNote = Syncable & { id: string; text: string; createdAtMs: number };

export const EMPTY_USAGE: ProviderUsage = {
  inputTextTokens: 0,
  outputTextTokens: 0,
  inputAudioTokens: 0,
  outputAudioTokens: 0,
};
