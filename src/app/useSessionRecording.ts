import { useRef } from "react";
import type { GoalConfirmation } from "../goals/types";
import type { StableDimensionReading } from "../measurement/types";
import type { AdaptiveMode } from "../performance/AdaptiveRateController";
import { SessionRecorder } from "../session/SessionRecorder";
import type { SessionRepository } from "../session/SessionRepository";
import type { SessionBundle, SessionRecord } from "../session/types";
import type { WobbleReading } from "../wobble/types";

const POLICY_REVISION = "2026-10-09";
const WOBBLE_EVENT_INTERVAL_MS = 2_000;

type ActiveSession = {
  id: string;
  created: boolean;
  recorder: SessionRecorder | null;
  lastWobble: { classification: WobbleReading["classification"]; recordedAtMs: number } | null;
};

/**
 * Persists one session at a time to IndexedDB. `reset()` starts a fresh session id, so recording
 * after a deletion never writes to (or fails against) the deleted session.
 */
export function useSessionRecording(repository: SessionRepository, onStorageFailed: () => void) {
  const sessionRef = useRef<ActiveSession | null>(null);

  function current(): ActiveSession {
    sessionRef.current ??= { id: newId("session"), created: false, recorder: null, lastWobble: null };
    return sessionRef.current;
  }

  async function begin(): Promise<void> {
    const session = current();
    if (session.created) return;
    const now = Date.now();
    const record: SessionRecord = {
      id: session.id, schemaVersion: 1, startedAtMs: now, endedAtMs: null, goal: null,
      deviceClass: navigator.userAgent.includes("Mobile") ? "phone" : "desktop", calibrationId: null, outcome: null,
      consent: emptyConsent(now),
    };
    try {
      await repository.create(record);
      session.created = true;
      session.recorder = new SessionRecorder(repository, record.id, { onStorageUnavailable: onStorageFailed });
    } catch {
      onStorageFailed();
    }
  }

  function recordReading(reading: StableDimensionReading): void {
    const session = current();
    session.recorder?.recordReading({ id: reading.id, sessionId: session.id, timestampMs: reading.timestampMs, kind: "stable",
      values: { heightMm: reading.heightMm, maximumWidthMm: reading.maximumWidthMm, rimWidthMm: reading.rimWidthMm, baseWidthMm: reading.baseWidthMm },
      confidence: reading.confidence.overall });
  }

  function recordWobble(reading: WobbleReading): void {
    const session = current();
    const previous = session.lastWobble;
    if (previous && previous.classification === reading.classification && reading.timestampMs - previous.recordedAtMs < WOBBLE_EVENT_INTERVAL_MS) return;
    session.lastWobble = { classification: reading.classification, recordedAtMs: reading.timestampMs };
    session.recorder?.recordEvent({ id: reading.id, sessionId: session.id, timestampMs: reading.timestampMs, type: "wobble-reading",
      evidenceIds: [reading.id], payload: { classification: reading.classification, confidence: reading.confidence,
        amplitudeMm: reading.amplitudeMm, periodMs: reading.periodMs, reasons: reading.reasons,
        sourceFrameRange: reading.sourceFrameIds.length ? [reading.sourceFrameIds[0], reading.sourceFrameIds.at(-1)] : [] } });
  }

  function recordMilestone(percent: number, evidenceId: string): void {
    const session = current();
    session.recorder?.recordEvent({ id: newId("event"), sessionId: session.id, timestampMs: Date.now(), type: "goal-milestone",
      evidenceIds: [evidenceId], payload: { percent } });
  }

  function recordProcessingMode(mode: AdaptiveMode): void {
    const session = current();
    session.recorder?.recordEvent({ id: newId("event"), sessionId: session.id, timestampMs: Date.now(), type: "processing-mode-change",
      evidenceIds: [], payload: mode });
  }

  async function setGoal(confirmation: GoalConfirmation): Promise<void> {
    const session = current();
    if (!session.created) return;
    try { await repository.update(session.id, { goal: confirmation.goal }); } catch { onStorageFailed(); }
  }

  async function markMoment(): Promise<void> {
    const session = current();
    if (!session.created) return;
    try {
      await repository.markMoment({ id: newId("moment"), sessionId: session.id, timestampMs: Date.now(), label: "User marked moment", stillBlobId: null, localOnly: true });
    } catch { onStorageFailed(); }
  }

  /** Flushes and closes the session, returning what was stored (or an empty bundle if storage failed). */
  async function end(): Promise<SessionBundle> {
    const session = current();
    const now = Date.now();
    try {
      await session.recorder?.flush();
      if (session.created) {
        await repository.update(session.id, { endedAtMs: now, outcome: "completed" });
        const stored = await repository.get(session.id);
        if (stored) return stored;
      }
    } catch {
      onStorageFailed();
    }
    return emptyBundle(session.id, now);
  }

  return { sessionId: () => current().id, begin, recordReading, recordWobble, recordMilestone, recordProcessingMode, setGoal, markMoment, end,
    reset: () => { sessionRef.current = null; } };
}

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyConsent(now: number): SessionRecord["consent"] {
  return { cameraLocal: true, cloudAudio: false, transcriptRetention: false, snapshotUpload: false, researchMedia: false,
    policyRevision: POLICY_REVISION, grantedAtMs: now };
}

function emptyBundle(id: string, now: number): SessionBundle {
  return { session: { id, schemaVersion: 1, startedAtMs: now, endedAtMs: now, goal: null, deviceClass: "unknown",
    calibrationId: null, outcome: "completed", consent: emptyConsent(now) },
    readings: [], diagnostics: [], events: [], moments: [], transcripts: [] };
}
