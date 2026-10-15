import type { ThrowingGoal } from "../goals/types";
import type { SessionScale } from "../measurement/scale";

export type ConsentState = {
  cameraLocal: boolean;
  cloudAudio: boolean;
  transcriptRetention: boolean;
  snapshotUpload: boolean;
  researchMedia: boolean;
  policyRevision: string;
  grantedAtMs: number;
};

export type SessionRecord = {
  id: string;
  /** 2 records readings in camera pixels with a session scale; 1 recorded millimetres directly. */
  schemaVersion: 1 | 2;
  startedAtMs: number;
  endedAtMs: number | null;
  goal: ThrowingGoal | null;
  deviceClass: string;
  calibrationId: string | null;
  consent: ConsentState;
  outcome: "completed" | "abandoned" | "failed" | null;
  /** Set whenever the potter calibrates, even after throwing; applies to every reading in the session. */
  scale?: SessionScale | null;
};

export type SessionEvent = {
  id: string;
  sessionId: string;
  timestampMs: number;
  type: string;
  evidenceIds: string[];
  payload: Record<string, unknown>;
};

export type RecordedReading = {
  id: string;
  sessionId: string;
  timestampMs: number;
  kind: "stable" | "diagnostic";
  /** Missing on schema 1 rows, which stored `heightMm`-style values. */
  unit?: "px" | "mm";
  values: Record<string, number | null>;
  confidence: number;
};

export type SessionDiagnostic = {
  id: string;
  sessionId: string;
  timestampMs: number;
  values: Record<string, number | string | boolean | null>;
};

export type MarkedMoment = {
  id: string;
  sessionId: string;
  timestampMs: number;
  label: string;
  stillBlobId: string | null;
  localOnly: boolean;
};

export type TranscriptEntry = { id: string; sessionId: string; timestampMs: number; text: string };
export type StoredBlob = { id: string; sessionId: string; blob: Blob };

export type SessionBundle = {
  session: SessionRecord;
  readings: RecordedReading[];
  diagnostics: SessionDiagnostic[];
  events: SessionEvent[];
  moments: MarkedMoment[];
  transcripts: TranscriptEntry[];
};

export type DeletionReceipt = {
  sessionId: string;
  requestedAtMs: number;
  completedAtMs: number;
  stores: Array<{ name: string; status: "deleted" | "not-present" | "provider-exception" }>;
};
