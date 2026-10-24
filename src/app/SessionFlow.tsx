import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { LiveSession } from "../live/LiveSession";
import { DeletionService } from "../privacy/DeletionService";
import { RetentionService } from "../privacy/RetentionService";
import { BrowserCacheDeletion, LocalStorageSyncQueueDeletion } from "../privacy/localDeletion";
import { releaseManifest } from "../release/manifest";
import { buildSummary } from "../review/buildSummary";
import { SessionReview } from "../review/SessionReview";
import { DeletionReceiptStatus, ReviewActions } from "../review/ReviewActions";
import { resolveRecordedSizes, sizesUnavailable } from "../session/recordedSizes";
import { SessionRepository } from "../session/SessionRepository";
import type { DeletionReceipt, SessionBundle } from "../session/types";
import { SetupStore } from "../setup/SetupStore";
import { loadTemplates } from "../targets/loadTemplates";
import { browserTransportDependencies, OpenAIWebRtcTransport } from "../voice/OpenAIWebRtcTransport";
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
import { SyncClient } from "../sync/SyncClient";
import { AboutScreen } from "./AboutScreen";
import { HomeScreen } from "./HomeScreen";
import { buildSessionHistory, type SessionHistoryItem } from "../history/sessionHistory";

const SHELL_KEY = "pottery-coach-session-shell";
const repository = new SessionRepository();
const throwLog = new ThrowLog();
const syncClient = new SyncClient(throwLog);
const flags = deriveGatedFeatureFlags(releaseManifest);
const DEFAULT_TARGET = loadTemplates()[0]!;

/**
 * Top-level journey: one tap on the welcome screen starts a hands-free live session; ending it shows
 * a review. The voice coach spans both, so it can give the spoken debrief after the camera stops.
 */
export function SessionFlow() {
  const [state, dispatch] = useReducer(transition, undefined, () => initialSessionState());
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [homeStatus, setHomeStatus] = useState<string | null>(null);
  const [deletionReceipt, setDeletionReceipt] = useState<DeletionReceipt | null>(null);
  const [demoMode] = useState(() => isDemoMode());
  const [cameraOnly] = useState(() => isCameraOnlyMode());
  const [setup, setSetup] = useState(() => new SetupStore());
  const [scripted] = useState(() => (demoMode ? new ScriptedVoice() : null));
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
    : CLOUD_VOICE
      ? () => new OpenAIWebRtcTransport(browserTransportDependencies())
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
    // Demo sessions never leave the phone.
    if (demoMode) return;
    const syncNow = () => void sync();
    syncNow();
    window.addEventListener("online", syncNow);
    return () => window.removeEventListener("online", syncNow);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  /** Pushes and pulls the throw log; when anything arrives, the coach's memory is rebuilt. */
  async function sync(): Promise<void> {
    if (demoMode) return;
    const result = await syncClient.sync().catch(() => "failed" as const);
    if (result === "synced") await memory.refresh().catch(() => undefined);
  }

  useEffect(() => {
    sessionStorage.setItem(SHELL_KEY, serializeSessionShell(state));
    const path = pathForState(state.step, state.reviewSessionId);
    if (window.location.pathname !== path) window.history.pushState(null, "", `${path}${window.location.search}`);
  }, [state]);

  useEffect(() => {
    const navigateFromHistory = () => {
      const path = window.location.pathname;
      if (path === "/about") dispatch({ type: "NAVIGATE", step: "about", sessionId: null });
      else if (path.startsWith("/session/review/"))
        dispatch({
          type: "NAVIGATE",
          step: "review",
          sessionId: decodeURIComponent(path.slice("/session/review/".length)),
        });
      else if (path === "/session/live") dispatch({ type: "NAVIGATE", step: "live", sessionId: null });
      else if (path === "/") dispatch({ type: "NAVIGATE", step: "home", sessionId: null });
    };
    window.addEventListener("popstate", navigateFromHistory);
    return () => window.removeEventListener("popstate", navigateFromHistory);
  }, []);

  useEffect(() => {
    if (state.step !== "home") return;
    void refreshHistory();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  useEffect(() => {
    if (state.step !== "review" || !state.reviewSessionId) return;
    if (bundle?.session.id === state.reviewSessionId) return;
    let cancelled = false;
    void repository.get(state.reviewSessionId).then((stored) => {
      if (cancelled) return;
      if (stored) {
        bundleRef.current = stored;
        setBundle(stored);
      } else {
        setHomeStatus("That session is no longer available on this device.");
        dispatch({ type: "GO_HOME" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bundle, state.reviewSessionId, state.step]);

  useEffect(() => {
    // Nothing is in progress on the welcome screen, so pick up a new version straight away.
    if (updated && state.step === "home") window.location.reload();
  }, [updated, state.step]);

  const updateBanner = updated && state.step !== "home" && (
    <div className="stale-banner" role="status">
      Pottery Coach has been updated. Reload when you're ready to use the new version.
      <button type="button" onClick={() => window.location.reload()}>
        Reload now
      </button>
    </div>
  );

  function startSession(): void {
    setHomeStatus(null);
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
    void memory
      .refresh()
      .then(sync)
      .catch(() => undefined);
    bundleRef.current = stored;
    setBundle(stored);
    dispatch({ type: "END_SESSION", sessionId: stored.session.id });
    void new RetentionService(repository).expire().catch(() => undefined);
  }

  async function deleteSession(sessionId: string) {
    const receipt = await new DeletionService(repository, {
      cache: typeof caches === "undefined" ? undefined : new BrowserCacheDeletion(caches),
      syncQueue: new LocalStorageSyncQueueDeletion(localStorage),
    }).deleteSession(sessionId);
    await throwLog.deleteSession(sessionId).catch(() => undefined);
    sessionStorage.removeItem(SHELL_KEY);
    setDeletionReceipt(receipt);
    bundleRef.current = null;
    setBundle(null);
    dispatch({ type: "GO_HOME" });
    return receipt;
  }

  function startAnotherSession(): void {
    setDeletionReceipt(null);
    void voice.stop();
    recording.reset();
    pieces.reset();
    bundleRef.current = null;
    setBundle(null);
    setSetup(new SetupStore());
    dispatch({ type: "START_NEW_SESSION" });
    void voice.start();
  }

  async function refreshHistory(): Promise<void> {
    const [sessions, loggedPieces] = await Promise.all([repository.list(), throwLog.listPieces()]).catch(() => [
      [],
      [],
    ]);
    setHistory(buildSessionHistory(sessions, loggedPieces));
  }

  function goHome(): void {
    bundleRef.current = null;
    setBundle(null);
    dispatch({ type: "GO_HOME" });
  }

  function openReview(sessionId: string): void {
    setHomeStatus(null);
    setDeletionReceipt(null);
    dispatch({ type: "OPEN_REVIEW", sessionId });
  }

  if (state.step === "home") {
    return (
      <div className="home-container">
        {updateBanner}
        {homeStatus && (
          <p className="home-status" role="status">
            {homeStatus}
          </p>
        )}
        {deletionReceipt && <DeletionReceiptStatus receipt={deletionReceipt} />}
        <HomeScreen
          sessions={history}
          onStart={startSession}
          onAbout={() => dispatch({ type: "SHOW_ABOUT" })}
          onOpenSession={openReview}
        />
      </div>
    );
  }

  if (state.step === "about")
    return <AboutScreen voiceAvailable={voice.available} demoMode={demoMode} onHome={goHome} onStart={startSession} />;

  if (state.step === "review" && bundle) {
    return (
      <section className="review-shell">
        {updateBanner}
        {sizesUnavailable(bundle) && (
          <p className="stale-banner">This session had no wheel-head size, so only shapes were tracked.</p>
        )}
        <SessionReview
          bundle={bundle}
          actions={
            <ReviewActions
              onStartNew={startAnotherSession}
              onDelete={() => deleteSession(bundle.session.id)}
              onHome={goHome}
            />
          }
        />
        <SessionPieces throwLog={throwLog} sessionId={bundle.session.id} />
      </section>
    );
  }

  if (state.step === "review") return <p role="status">Loading session…</p>;

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
        onNextPiece={() => pieces.next().then(() => void sync())}
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

function initialSessionState() {
  const state =
    typeof sessionStorage === "undefined"
      ? createSessionState()
      : restoreSessionShell(sessionStorage.getItem(SHELL_KEY));
  if (typeof window === "undefined") return state;
  if (window.location.pathname === "/about") return transition(state, { type: "SHOW_ABOUT" });
  if (window.location.pathname.startsWith("/session/review/"))
    return transition(state, {
      type: "OPEN_REVIEW",
      sessionId: decodeURIComponent(window.location.pathname.slice("/session/review/".length)),
    });
  return state;
}

function pathForState(step: string, reviewSessionId: string | null): string {
  if (step === "home") return "/";
  if (step === "about") return "/about";
  if (step === "review" && reviewSessionId) return `/session/review/${encodeURIComponent(reviewSessionId)}`;
  return "/session/live";
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
