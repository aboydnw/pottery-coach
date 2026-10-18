import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { LiveSession } from "../live/LiveSession";
import { DeleteSessionDialog } from "../privacy/DeleteSessionDialog";
import { DeletionService } from "../privacy/DeletionService";
import { RetentionService } from "../privacy/RetentionService";
import { BrowserCacheDeletion, LocalStorageSyncQueueDeletion } from "../privacy/localDeletion";
import { releaseManifest } from "../release/manifest";
import { buildSummary } from "../review/buildSummary";
import { SessionReview } from "../review/SessionReview";
import { resolveRecordedSizes, sizesUnavailable } from "../session/recordedSizes";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionBundle } from "../session/types";
import { SetupStore } from "../setup/SetupStore";
import { loadTemplates } from "../targets/loadTemplates";
import { browserTransportDependencies, OpenAIWebRtcTransport } from "../voice/OpenAIWebRtcTransport";
import { forgetPassphrase, loadPassphrase, savePassphrase } from "../voice/passphrase";
import { ScriptedVoice } from "../voice/scriptedVoice";
import { createToolRegistry } from "../voice/tools/registry";
import type { SpokenSummary, ToolDependencies } from "../voice/tools/types";
import { useVoiceSession } from "../voice/useVoiceSession";
import { createSessionState, restoreSessionShell, serializeSessionShell, transition } from "./AppSessionOrchestrator";
import { isCameraOnlyMode, isDemoMode } from "./demoMode";
import { CLOUD_VOICE, deriveGatedFeatureFlags, UNVERIFIED_MEASUREMENTS } from "./featureFlags";
import { useAppUpdate } from "./useAppUpdate";
import { useSessionRecording } from "./useSessionRecording";
import { useCoachMemory } from "./useCoachMemory";
import { usePieces } from "./usePieces";
import { SessionPieces } from "../pieces/SessionPieces";
import { ThrowLog } from "../pieces/ThrowLog";

const SHELL_KEY = "pottery-coach-session-shell";
const repository = new SessionRepository();
const throwLog = new ThrowLog();
const flags = deriveGatedFeatureFlags(releaseManifest);
const DEFAULT_TARGET = loadTemplates()[0]!;

/**
 * Top-level journey: one tap on the welcome screen starts a hands-free live session; ending it shows
 * a review. The voice coach spans both, so it can give the spoken debrief after the camera stops.
 */
export function SessionFlow() {
  const [state, dispatch] = useReducer(transition, undefined, () =>
    typeof sessionStorage === "undefined"
      ? createSessionState()
      : restoreSessionShell(sessionStorage.getItem(SHELL_KEY)),
  );
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [demoMode] = useState(() => isDemoMode());
  const [cameraOnly] = useState(() => isCameraOnlyMode());
  const [setup, setSetup] = useState(() => new SetupStore());
  const [scripted] = useState(() => (demoMode ? new ScriptedVoice() : null));
  const [passphrase, setPassphrase] = useState(() => (CLOUD_VOICE ? loadPassphrase() : null));
  const [passphraseDraft, setPassphraseDraft] = useState("");
  const updated = useAppUpdate();
  const recording = useSessionRecording(repository, () => dispatch({ type: "STORAGE_FAILED" }));
  const bridge = useRef<Partial<ToolDependencies>>({});
  const bundleRef = useRef<SessionBundle | null>(null);
  const setupRef = useRef(setup);
  const pieces = usePieces(throwLog, recording, () => {
    const goal = bridge.current.getGoal?.() ?? null;
    return {
      targetId: setupRef.current.getSnapshot().targetId.value,
      goalHeightMm: goal?.wetHeightMm ?? null,
      goalBasis: goal?.goal.basis ?? null,
    };
  });
  const memory = useCoachMemory(throwLog, (context) => appRef.current?.voice.setPotterContext(context));
  // The tool registry is built once, so it reaches the latest hooks through this ref.
  const appRef = useRef<{ pieces: typeof pieces; memory: typeof memory; voice: typeof voice } | null>(null);
  const sizesEnabled = flags.numericMeasurement || demoMode || UNVERIFIED_MEASUREMENTS;

  const registry = useMemo(
    () =>
      createToolRegistry({
        now: () => Date.now(),
        getReading: () => bridge.current.getReading?.() ?? null,
        getScale: () => bridge.current.getScale?.() ?? null,
        getWobble: () => bridge.current.getWobble?.() ?? null,
        getTarget: () => bridge.current.getTarget?.() ?? DEFAULT_TARGET,
        getGoal: () => bridge.current.getGoal?.() ?? null,
        get setup() {
          return setupRef.current;
        },
        get wheel() {
          return bridge.current.wheel;
        },
        setPaused: (paused) => bridge.current.setPaused?.(paused),
        get markMoment() {
          return bridge.current.markMoment;
        },
        get endSession() {
          return bridge.current.endSession;
        },
        get nextPiece() {
          return bridge.current.nextPiece;
        },
        get reportTrueSize() {
          return bridge.current.reportTrueSize;
        },
        rateLastCue: (verdict) => appRef.current?.pieces.rateLastCue(verdict) ?? Promise.resolve(false),
        notes: {
          remember: async (text, lasting) => {
            if (lasting) await appRef.current?.memory.remember(text);
            else await appRef.current?.pieces.addNote(text);
          },
          find: (text) => throwLog.findNote(text),
          forget: async (id) => appRef.current?.memory.forget(id),
        },
        get getSessionSummary() {
          const finished = bundleRef.current;
          return finished ? async () => spokenSummary(finished) : undefined;
        },
      }),
    // The registry reads everything through refs, so it is built once.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const createTransport = scripted
    ? () => scripted.transport
    : passphrase
      ? () => new OpenAIWebRtcTransport(browserTransportDependencies(() => passphrase))
      : null;
  const voice = useVoiceSession(createTransport, registry, {
    onUsage: (usage) => void pieces.addUsage(usage).catch(() => undefined),
    getPotterContext: memory.context,
  });

  useEffect(() => {
    appRef.current = { pieces, memory, voice };
  });

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  useEffect(() => {
    if (!scripted) return;
    window.__potteryVoice = scripted;
    return () => {
      delete window.__potteryVoice;
    };
  }, [scripted]);

  useEffect(() => {
    void new RetentionService(repository).expire().catch(() => undefined);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SHELL_KEY, serializeSessionShell(state));
    const path = state.step === "notice" ? "/" : `/session/${state.step}`;
    if (window.location.pathname !== path) window.history.replaceState(null, "", `${path}${window.location.search}`);
  }, [state]);

  useEffect(() => {
    // Nothing is in progress on the welcome screen, so pick up a new version straight away.
    if (updated && state.step === "notice") window.location.reload();
  }, [updated, state.step]);

  const updateBanner = updated && state.step !== "notice" && (
    <div className="stale-banner" role="status">
      Pottery Coach has been updated. Reload when you're ready to use the new version.
      <button type="button" onClick={() => window.location.reload()}>
        Reload now
      </button>
    </div>
  );

  function startSession(): void {
    dispatch({ type: "START_SESSION" });
    void voice.start();
  }

  async function endSession({ byVoice = false }: { byVoice?: boolean } = {}): Promise<void> {
    // Ending by touch hangs up straight away; by voice, the coach says goodbye first.
    if (byVoice) voice.hangUpAfterReply();
    else void voice.stop();
    const recorded = await recording.end();
    const stored = resolveRecordedSizes(recorded);
    await pieces.finish(recorded).catch(() => undefined);
    void memory.refresh().catch(() => undefined);
    bundleRef.current = stored;
    setBundle(stored);
    dispatch({ type: "END_SESSION" });
    void new RetentionService(repository).expire().catch(() => undefined);
  }

  async function deleteSession() {
    const receipt = await new DeletionService(repository, {
      cache: typeof caches === "undefined" ? undefined : new BrowserCacheDeletion(caches),
      syncQueue: new LocalStorageSyncQueueDeletion(localStorage),
    }).deleteSession(recording.sessionId());
    await throwLog.deleteSession(recording.sessionId()).catch(() => undefined);
    sessionStorage.removeItem(SHELL_KEY);
    return receipt;
  }

  function startAnotherSession(): void {
    void voice.stop();
    recording.reset();
    pieces.reset();
    bundleRef.current = null;
    setBundle(null);
    setSetup(new SetupStore());
    dispatch({ type: "DELETE_SESSION" });
  }

  if (state.step === "notice") {
    return (
      <section className="notice" aria-labelledby="notice-title">
        {updateBanner}
        <p className="eyebrow">Controlled prototype</p>
        <h1 id="notice-title">Ready when your hands are clean</h1>
        <p>
          One tap starts the camera and, if it's set up, your voice coach. After that you won't need to touch the
          screen: talk to the coach through your headphones.
        </p>
        <p className="tip">
          <strong>Start with an empty wheel.</strong> The coach takes a quick look at it first, then tells you to put
          your clay on.
        </p>
        <p>
          Camera frames are processed on this phone and never stored or uploaded. It is not safety equipment.
          {voice.available && " Your voice goes to the coach's speech service while the session runs."}
        </p>
        {CLOUD_VOICE && !scripted && (
          <div className="voice-setup">
            {passphrase ? (
              <p>
                Voice coach is on for this phone.{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    forgetPassphrase();
                    setPassphrase(null);
                  }}
                >
                  Forget passphrase
                </button>
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!passphraseDraft.trim()) return;
                  savePassphrase(passphraseDraft);
                  setPassphrase(passphraseDraft.trim());
                  setPassphraseDraft("");
                }}
              >
                <label>
                  Voice passphrase (once per phone)
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={passphraseDraft}
                    onChange={(event) => setPassphraseDraft(event.target.value)}
                  />
                </label>
                <button type="submit" className="secondary">
                  Turn on voice coach
                </button>
                <p>Without it, you can still set up by touch.</p>
              </form>
            )}
          </div>
        )}
        <button type="button" className="start-button" onClick={startSession}>
          Start session
        </button>
      </section>
    );
  }

  if (state.step === "review" && bundle) {
    return (
      <section className="review-shell">
        {updateBanner}
        {sizesUnavailable(bundle) && (
          <p className="stale-banner">This session had no wheel-head size, so only shapes were tracked.</p>
        )}
        <SessionReview bundle={bundle} />
        <SessionPieces throwLog={throwLog} sessionId={bundle.session.id} />
        <DeleteSessionDialog onDelete={deleteSession} onFinish={startAnotherSession} />
      </section>
    );
  }

  return (
    <>
      {updateBanner}
      {!state.modes.storage && (
        <div className="stale-banner" role="alert">
          Session storage is unavailable. Live coaching can continue, but this session cannot be reviewed later.
        </div>
      )}
      <LiveSession
        setup={setup}
        toolBridge={bridge}
        voice={voice}
        sizesEnabled={sizesEnabled}
        measurementsUnverified={!flags.numericMeasurement && UNVERIFIED_MEASUREMENTS}
        demoMode={demoMode}
        cameraOnly={cameraOnly}
        onCameraReady={() =>
          void recording
            .begin()
            .then(() => pieces.ensureStarted())
            .catch(() => undefined)
        }
        throwLog={throwLog}
        pieceId={pieces.pieceId}
        pieceNumber={pieces.pieceNumber}
        lastingNotes={memory.notes}
        onForgetNote={(id) => void memory.forget(id)}
        onNextPiece={() => pieces.next()}
        onCorrection={(correction) => void pieces.addCorrection(correction).catch(() => undefined)}
        onCue={(policyId, text) => void pieces.logCue(policyId, text).catch(() => undefined)}
        onCameraDenied={() => dispatch({ type: "CAMERA_DENIED" })}
        onReading={recording.recordReading}
        onWobble={recording.recordWobble}
        onMilestone={recording.recordMilestone}
        onProcessingModeChange={recording.recordProcessingMode}
        onScale={(scale) => void recording.setScale(scale)}
        onGoal={(goal) => void recording.setGoal(goal)}
        onMarkMoment={() => recording.markMoment()}
        onEnd={endSession}
      />
    </>
  );
}

function spokenSummary(bundle: SessionBundle): SpokenSummary {
  const summary = buildSummary(bundle);
  const endedAtMs = bundle.session.endedAtMs ?? bundle.session.startedAtMs;
  return {
    durationMinutes: Math.round(((endedAtMs - bundle.session.startedAtMs) / 60_000) * 10) / 10,
    sizesAvailable: Boolean(bundle.session.scale) || bundle.readings.some((reading) => reading.unit !== "px"),
    peakHeightMm: summary.peak.heightMm,
    finalHeightMm: summary.final.heightMm,
    finalMaximumWidthMm: summary.final.maximumWidthMm,
    goalHeightMm: bundle.session.goal?.desiredHeightMm ?? null,
    markedMoments: bundle.moments.length,
  };
}
