import { useEffect, useReducer, useState } from "react";
import { CameraSetup } from "../camera/CameraSetup";
import { DeleteSessionDialog } from "../privacy/DeleteSessionDialog";
import { DeletionService } from "../privacy/DeletionService";
import { RetentionService } from "../privacy/RetentionService";
import { BrowserCacheDeletion, LocalStorageSyncQueueDeletion } from "../privacy/localDeletion";
import { releaseManifest } from "../release/manifest";
import { SessionReview } from "../review/SessionReview";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionBundle } from "../session/types";
import { createSessionState, restoreSessionShell, serializeSessionShell, transition } from "./AppSessionOrchestrator";
import { isCameraOnlyMode, isDemoMode } from "./demoMode";
import { deriveGatedFeatureFlags } from "./featureFlags";
import { useSessionRecording } from "./useSessionRecording";

const SHELL_KEY = "pottery-coach-session-shell";
const repository = new SessionRepository();
const flags = deriveGatedFeatureFlags(releaseManifest);

/** Top-level journey: privacy notice, live camera session, then review and deletion. */
export function SessionFlow() {
  const [state, dispatch] = useReducer(transition, undefined, () =>
    typeof sessionStorage === "undefined" ? createSessionState() : restoreSessionShell(sessionStorage.getItem(SHELL_KEY)));
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [demoMode] = useState(() => isDemoMode());
  const [cameraOnly] = useState(() => isCameraOnlyMode());
  const recording = useSessionRecording(repository, () => dispatch({ type: "STORAGE_FAILED" }));

  useEffect(() => { void new RetentionService(repository).expire().catch(() => undefined); }, []);
  useEffect(() => {
    sessionStorage.setItem(SHELL_KEY, serializeSessionShell(state));
    const path = state.step === "notice" ? "/" : `/session/${state.step}`;
    if (window.location.pathname !== path) window.history.replaceState(null, "", `${path}${window.location.search}`);
  }, [state]);

  async function endSession(): Promise<void> {
    const stored = await recording.end();
    setBundle(stored);
    dispatch({ type: "END_SESSION" });
    void new RetentionService(repository).expire().catch(() => undefined);
  }

  async function deleteSession() {
    const receipt = await new DeletionService(repository, {
      cache: typeof caches === "undefined" ? undefined : new BrowserCacheDeletion(caches),
      syncQueue: new LocalStorageSyncQueueDeletion(localStorage),
    }).deleteSession(recording.sessionId());
    sessionStorage.removeItem(SHELL_KEY);
    return receipt;
  }

  function startAnotherSession(): void {
    recording.reset();
    setBundle(null);
    dispatch({ type: "DELETE_SESSION" });
  }

  if (state.step === "notice") {
    return (
      <section className="notice" aria-labelledby="notice-title">
        <p className="eyebrow">Controlled prototype</p>
        <h1 id="notice-title">Before you begin</h1>
        <p>Pottery Coach processes camera frames on this device. It is not safety equipment. Raw video is not stored or uploaded, and microphone access is a separate choice.</p>
        <button onClick={() => dispatch({ type: "ACCEPT_NOTICE" })}>Begin private setup</button>
      </section>
    );
  }

  if (state.step === "review" && bundle) {
    return (
      <section className="review-shell">
        <SessionReview bundle={bundle} />
        <DeleteSessionDialog onDelete={deleteSession} onFinish={startAnotherSession} />
      </section>
    );
  }

  return (
    <>
      {!state.modes.storage && (
        <div className="stale-banner" role="alert">
          Session storage is unavailable. Live coaching can continue ephemerally, but this session cannot be reviewed later.
        </div>
      )}
      <CameraSetup
        step={state.step}
        numericEnabled={flags.numericMeasurement || demoMode}
        demoMode={demoMode}
        cameraOnly={cameraOnly}
        onCameraReady={() => { dispatch({ type: "CAMERA_READY" }); void recording.begin(); }}
        onCameraDenied={() => dispatch({ type: "CAMERA_DENIED" })}
        onCameraStopped={() => dispatch({ type: "CAMERA_STOPPED" })}
        onCalibrated={() => dispatch({ type: "CALIBRATED" })}
        onRecalibrate={() => dispatch({ type: "RECALIBRATE" })}
        onAudioDecided={() => dispatch({ type: "AUDIO_DECIDED" })}
        onGoalSet={(goal) => { dispatch({ type: "GOAL_SET" }); void recording.setGoal(goal); }}
        onGoalCleared={() => dispatch({ type: "GOAL_CLEARED" })}
        onReading={recording.recordReading}
        onWobble={recording.recordWobble}
        onMilestone={recording.recordMilestone}
        onProcessingModeChange={recording.recordProcessingMode}
        onMarkMoment={recording.markMoment}
        onEnded={() => void endSession()}
      />
    </>
  );
}
