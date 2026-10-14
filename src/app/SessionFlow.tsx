import { useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CameraSetup } from "../camera/CameraSetup";
import type { StableDimensionReading } from "../measurement/types";
import { DeleteSessionDialog } from "../privacy/DeleteSessionDialog";
import { DeletionService } from "../privacy/DeletionService";
import { RetentionService } from "../privacy/RetentionService";
import { BrowserCacheDeletion, LocalStorageSyncQueueDeletion } from "../privacy/localDeletion";
import { SessionReview } from "../review/SessionReview";
import { SessionRecorder } from "../session/SessionRecorder";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionBundle, SessionRecord } from "../session/types";
import type { GoalConfirmation } from "../goals/types";
import type { WobbleReading } from "../wobble/types";
import { createSessionState, restoreSessionShell, serializeSessionShell, transition, type SessionEvent } from "./AppSessionOrchestrator";
import { deriveSignedFeatureFlags } from "./featureFlags";
import { releaseManifest } from "../release/manifest";
import type { AdaptiveMode } from "../performance/AdaptiveRateController";

const repository = new SessionRepository();

export function AppRoutes() {
  const navigate = useNavigate();
  const flags = deriveSignedFeatureFlags(releaseManifest);
  const demoMode = new URLSearchParams(window.location.search).get("mode") === "demo";
  const [state, dispatchBase] = useReducer(transition, undefined, () =>
    typeof sessionStorage === "undefined" ? createSessionState() : restoreSessionShell(sessionStorage.getItem("pottery-coach-session-shell")));
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const sessionId = useRef(globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`);
  const recorder = useRef<SessionRecorder | null>(null);
  const created = useRef(false);
  const dispatch = (event: SessionEvent) => dispatchBase(event);

  useEffect(() => { void new RetentionService(repository).expire().catch(() => undefined); }, []);
  useEffect(() => {
    sessionStorage.setItem("pottery-coach-session-shell", serializeSessionShell(state));
    const path = state.step === "notice" ? "/" : `/session/${state.step}`;
    if (window.location.pathname !== path) void navigate(`${path}${window.location.search}`, { replace: true });
  }, [state, navigate]);

  async function cameraReady() {
    dispatch({ type: "CAMERA_READY" });
    if (created.current) return;
    const now = Date.now();
    const record: SessionRecord = { id: sessionId.current, schemaVersion: 1, startedAtMs: now, endedAtMs: null,
      goal: null, deviceClass: navigator.userAgent.includes("Mobile") ? "phone" : "desktop", calibrationId: null, outcome: null,
      consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false, snapshotUpload: false,
        researchMedia: false, policyRevision: "2026-10-09", grantedAtMs: now } };
    try {
      await repository.create(record); created.current = true;
      recorder.current = new SessionRecorder(repository, record.id, { onStorageUnavailable: () => dispatch({ type: "STORAGE_FAILED" }) });
    } catch { dispatch({ type: "STORAGE_FAILED" }); }
  }

  function recordReading(reading: StableDimensionReading) {
    recorder.current?.recordReading({ id: reading.id, sessionId: sessionId.current, timestampMs: reading.timestampMs,
      kind: "stable", values: { heightMm: reading.heightMm, maximumWidthMm: reading.maximumWidthMm,
        rimWidthMm: reading.rimWidthMm, baseWidthMm: reading.baseWidthMm }, confidence: reading.confidence.overall });
  }

  function recordWobble(reading: WobbleReading) {
    recorder.current?.recordEvent({ id: reading.id, sessionId: sessionId.current, timestampMs: reading.timestampMs,
      type: "wobble-reading", evidenceIds: reading.sourceFrameIds.map(String), payload: {
        classification: reading.classification, confidence: reading.confidence, amplitudeMm: reading.amplitudeMm,
        periodMs: reading.periodMs, reasons: reading.reasons } });
  }
  function recordMilestone(percent: number, evidenceId: string) {
    recorder.current?.recordEvent({ id: crypto.randomUUID(), sessionId: sessionId.current, timestampMs: Date.now(),
      type: "goal-milestone", evidenceIds: [evidenceId], payload: { percent } });
  }
  function recordProcessingMode(mode: AdaptiveMode) {
    recorder.current?.recordEvent({ id: crypto.randomUUID(), sessionId: sessionId.current, timestampMs: Date.now(),
      type: "processing-mode-change", evidenceIds: [], payload: mode });
  }

  async function goalSet(confirmation: GoalConfirmation) {
    dispatch({ type: "GOAL_SET" });
    if (created.current) await repository.update(sessionId.current, { goal: confirmation.goal });
  }

  async function markMoment() {
    if (!created.current) return;
    const now = Date.now();
    await repository.markMoment({ id: crypto.randomUUID(), sessionId: sessionId.current, timestampMs: now,
      label: "User marked moment", stillBlobId: null, localOnly: true });
  }

  async function endSession() {
    const now = Date.now();
    await recorder.current?.flush();
    if (created.current) await repository.update(sessionId.current, { endedAtMs: now, outcome: "completed" });
    const stored = created.current ? await repository.get(sessionId.current) : undefined;
    setBundle(stored ?? emptyBundle(sessionId.current, now));
    dispatch({ type: "END_SESSION" });
    void new RetentionService(repository).expire(now).catch(() => undefined);
  }

  if (state.step === "notice") return <section className="notice" aria-labelledby="notice-title">
    <p className="eyebrow">Controlled prototype</p><h1 id="notice-title">Before you begin</h1>
    <p>Pottery Coach processes camera frames on this device. It is not safety equipment. Raw video is not stored or uploaded, and microphone access is a separate choice.</p>
    <button onClick={() => dispatch({ type: "ACCEPT_NOTICE" })}>Begin private setup</button>
  </section>;

  if (state.step === "review" && bundle) return <section className="review-shell"><SessionReview bundle={bundle} />
    <DeleteSessionDialog onDelete={async () => {
      const receipt = await new DeletionService(repository, {
        cache: typeof caches === "undefined" ? undefined : new BrowserCacheDeletion(caches),
        syncQueue: new LocalStorageSyncQueueDeletion(localStorage),
      }).deleteSession(sessionId.current);
      sessionStorage.removeItem("pottery-coach-session-shell"); return receipt;
    }} onFinish={() => dispatch({ type: "DELETE_SESSION" })} /></section>;

  return <>{!state.modes.storage && <div className="stale-banner" role="alert">Session storage is unavailable. Live coaching can continue ephemerally, but this session cannot be reviewed later.</div>}
    <CameraSetup onCameraReady={() => void cameraReady()} onCameraDenied={() => dispatch({ type: "CAMERA_DENIED" })}
    onCalibrated={() => dispatch({ type: "CALIBRATED" })} onAudioDecided={() => dispatch({ type: "AUDIO_DECIDED" })}
    onGoalSet={(goal) => void goalSet(goal)} onReading={recordReading} onWobble={recordWobble} onMilestone={recordMilestone}
    onProcessingModeChange={recordProcessingMode}
    onMarkMoment={() => void markMoment()} onEnded={() => void endSession()}
    numericEnabled={flags.numericMeasurement || demoMode} /></>;
}

function emptyBundle(id: string, now: number): SessionBundle {
  return { session: { id, schemaVersion: 1, startedAtMs: now, endedAtMs: now, goal: null, deviceClass: "unknown",
    calibrationId: null, outcome: "completed", consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false,
      snapshotUpload: false, researchMedia: false, policyRevision: "2026-10-09", grantedAtMs: now } },
    readings: [], diagnostics: [], events: [], moments: [], transcripts: [] };
}
