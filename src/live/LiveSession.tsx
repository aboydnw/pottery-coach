import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject } from "react";

import { demoCalibration, demoReading } from "../app/demoFixtures";
import { CalibrationFlow, describeCalibrationReason } from "../calibration/CalibrationFlow";
import { calibrateFromVideo } from "../calibration/calibrateFromVideo";
import type { CalibrationResult } from "../calibration/types";
import { WasmTagDetector } from "../calibration/WasmTagDetector";
import { detectWheelHead, toGray, wheelHeadCalibration, type WheelHeadDetection } from "../calibration/wheelHead";
import { WheelHeadConfirm } from "../calibration/WheelHeadConfirm";
import { nudgeMarker, type WheelEdges } from "../calibration/wheelMarkers";
import { WheelHeadStep } from "../calibration/WheelHeadStep";
import { loadRememberedDiameterMm } from "../calibration/wheelSize";
import { captureFrame } from "../camera/captureFrame";
import { useCamera } from "../camera/useCamera";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";
import { toWetGoal } from "../goals/sizeGoal";
import type { GoalConfirmation } from "../goals/types";
import { scaleFromCalibration, toMm, type SessionScale } from "../measurement/scale";
import type { StableDimensionReading } from "../measurement/types";
import type { AdaptiveMode } from "../performance/AdaptiveRateController";
import type { SetupStore } from "../setup/SetupStore";
import { compareProfiles } from "../targets/compareProfiles";
import { GoalProgress } from "../targets/GoalProgress";
import { loadTemplates } from "../targets/loadTemplates";
import { ProfileOverlay } from "../targets/ProfileOverlay";
import { useMeasurementPipeline } from "../vision/useMeasurementPipeline";
import type { ToolDependencies } from "../voice/tools/types";
import type { Caption } from "../voice/useVoiceSession";
import { NOTICES, speakNotice } from "../voice/spokenNotice";
import { StabilityStatus } from "../wobble/StabilityStatus";
import type { WobbleReading } from "../wobble/types";
import { Captions } from "./Captions";
import { LiveReadouts } from "./LiveReadouts";
import { SetupChecklist } from "./SetupChecklist";
import { useLiveCues } from "./useLiveCues";
import { HistoryPanel } from "../pieces/HistoryPanel";
import { NotesPanel } from "../pieces/NotesPanel";
import type { ThrowLog } from "../pieces/ThrowLog";
import type { LastingNote, SizeCorrection } from "../pieces/types";

const TEMPLATES = loadTemplates();
/** Wait for the camera's exposure to settle before keeping the empty-wheel reference still. */
const PLATE_STILL_DELAY_MS = 700;
/** After "next piece", the wheel must look empty this long before it is learned again. */
const EMPTY_WHEEL_MS = 1_000;
/** If the old background has drifted and the wheel never looks empty, learn it again anyway. */
const EMPTY_WHEEL_TIMEOUT_MS = 30_000;
const CUE_TOAST_MS = 6_000;
const LINES = {
  liftPot: "Lift the pot off and I'll take a fresh look at the empty wheel.",
  wheelSeen: "Got a look at the empty wheel. Put your clay on.",
} as const;

/** Where the empty-wheel snapshot is at: learning it, learned (clay can go on), or waiting for the wheel to clear. */
type WheelPhase = "learning" | "ready" | "awaiting-empty" | "placed";

type WheelCheckState = { image: ImageData; detection: WheelHeadDetection; edges: WheelEdges; adjusted: boolean };

export type LiveSessionProps = {
  setup: SetupStore;
  /** Filled with the live parts of the voice tools while this session is on screen. */
  toolBridge: MutableRefObject<Partial<ToolDependencies>>;
  voice: {
    available: boolean;
    state: string;
    failure: string | null;
    captions: Caption[];
    restart(): Promise<void>;
    isBusy(): boolean;
    speakCue(id: string, text: string): boolean;
  };
  throwLog: ThrowLog;
  /** The current piece (pot) and its number in this session. */
  pieceId: string | null;
  pieceNumber: number;
  lastingNotes: LastingNote[];
  onForgetNote(id: string): void;
  onNextPiece(): Promise<void>;
  onCorrection(correction: SizeCorrection): void;
  onCue(policyId: string, text: string): void;
  /** False while the measurement gate is closed: sizes are never shown, only shapes. */
  sizesEnabled: boolean;
  measurementsUnverified: boolean;
  demoMode: boolean;
  cameraOnly: boolean;
  onCameraReady(): void;
  onCameraDenied(): void;
  onReading(reading: StableDimensionReading): void;
  onWobble(reading: WobbleReading): void;
  onMilestone(percent: number, evidenceId: string): void;
  onProcessingModeChange(mode: AdaptiveMode): void;
  onScale(scale: SessionScale | null): void;
  onGoal(goal: GoalConfirmation): void;
  onMarkMoment(): Promise<{ id: string; timestampMs: number }>;
  /** Ends the session; `byVoice` lets the coach say goodbye before the call closes. */
  onEnd(options?: { byVoice?: boolean }): Promise<void>;
};

/**
 * The hands-free session screen. It starts measuring the moment it appears, keeps setup in slots the
 * voice coach (or touch fallback) can fill at any time, and is otherwise only for glancing at.
 */
export function LiveSession(props: LiveSessionProps) {
  const { setup, toolBridge, voice, sizesEnabled, demoMode, cameraOnly } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef, { onDenied: props.onCameraDenied });
  const pipeline = useMeasurementPipeline({
    onReading: props.onReading,
    onWobble: props.onWobble,
    onProcessingModeChange: props.onProcessingModeChange,
    onBackgroundReady: () => {
      setPhase("ready");
      // At the start the coach's greeting says this; after "next piece" the app says it.
      if (announceWheelRef.current && !voice.speakCue("wheel-seen", LINES.wheelSeen)) showToast(LINES.wheelSeen);
      announceWheelRef.current = false;
    },
  });
  const slots = useSyncExternalStore(setup.subscribe, setup.getSnapshot);
  const [scale, setScaleState] = useState<SessionScale | null>(null);
  const [wheelCheck, setWheelCheck] = useState<WheelCheckState | null>(null);
  const [boardMode, setBoardMode] = useState(false);
  const [boardCandidate, setBoardCandidate] = useState<CalibrationResult | null>(null);
  const [detector, setDetector] = useState<WasmTagDetector | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [momentMarked, setMomentMarked] = useState(false);
  // Without voice, setup has to be done by touch, so settings start open.
  const [settingsOpen, setSettingsOpen] = useState(!voice.available);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [wheelPhase, setWheelPhase] = useState<WheelPhase>("learning");
  const [cueToast, setCueToast] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const wheelPhaseRef = useRef<WheelPhase>("learning");
  const announceWheelRef = useRef(false);
  const demoTimerRef = useRef<number | null>(null);
  const plateRef = useRef<ImageData | null>(null);
  const wheelRef = useRef<WheelCheckState | null>(null);

  const target = TEMPLATES.find((template) => template.id === slots.targetId.value) ?? TEMPLATES[0]!;
  const goal = useMemo<GoalConfirmation | null>(() => {
    if (!slots.goal?.confirmed) return null;
    const { basis, heightMm, shrinkageFraction } = slots.goal.value;
    return toWetGoal({
      id: `goal-${heightMm}-${basis}`,
      targetId: target.id,
      basis,
      desiredHeightMm: heightMm,
      desiredMaximumWidthMm: null,
      shrinkageFraction,
    });
  }, [slots.goal, target.id]);
  const activeScale = sizesEnabled ? scale : null;
  const reading = pipeline.stableReading;
  const sized = reading ? toMm(reading, activeScale) : null;
  const comparison = useMemo(
    () => (sized && goal ? compareProfiles(sized, { ...target, intendedWetHeightMm: goal.wetHeightMm }) : null),
    [sized, goal, target],
  );
  const mirrored = camera.facing === "user" && camera.settings?.facingMode !== "environment";

  useEffect(() => {
    if (goal) props.onGoal(goal);
    // Only a newly confirmed goal needs recording.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  useEffect(() => {
    // Development mode mounts twice; the camera controller cancels the superseded first start.
    void startCamera();
    // Start right after the session's single tap.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => detector?.dispose(), [detector]);

  useEffect(
    () => () => {
      if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    },
    [],
  );

  // Clay on the wheel ends the "put your clay on" prompt.
  useEffect(() => {
    if (wheelPhase === "ready" && pipeline.vesselVisible) setPhase("placed");
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelPhase, pipeline.vesselVisible]);

  // After "next piece", wait until the old snapshot sees nothing (the pot is off), then learn the
  // empty wheel again. A drifted snapshot may never look empty, so there's a time limit.
  useEffect(() => {
    if (wheelPhase !== "awaiting-empty") return;
    const relearn = () => {
      setPhase("learning");
      pipeline.resetBackground();
    };
    const limit = window.setTimeout(relearn, EMPTY_WHEEL_TIMEOUT_MS);
    const empty = pipeline.vesselVisible ? null : window.setTimeout(relearn, EMPTY_WHEEL_MS);
    return () => {
      window.clearTimeout(limit);
      if (empty !== null) window.clearTimeout(empty);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelPhase, pipeline.vesselVisible]);

  useLiveCues({
    pieceId: props.pieceId,
    reading,
    sized,
    wobble: activeScale ? pipeline.wobbleReading : null,
    target,
    goalHeightMm: goal?.wetHeightMm ?? null,
    handsLikely: pipeline.handsLikely,
    paused,
    isBusy: voice.isBusy,
    onCue: (policyId, text) => {
      if (!voice.speakCue(policyId, text)) showToast(text);
      props.onCue(policyId, text);
    },
  });

  // If the voice coach is refused or switched off, setup has to happen by touch.
  useEffect(() => {
    if (voice.failure === "unauthorized" || voice.failure === "disabled") setSettingsOpen(true);
  }, [voice.failure]);

  function setPhase(next: WheelPhase): void {
    wheelPhaseRef.current = next;
    setWheelPhase(next);
  }

  function showToast(text: string): void {
    setCueToast(text);
    window.setTimeout(() => setCueToast((current) => (current === text ? null : current)), CUE_TOAST_MS);
  }

  /** Saves this pot and waits for the wheel to be cleared before learning it again. */
  async function nextPiece(): Promise<void> {
    await props.onNextPiece();
    announceWheelRef.current = true;
    setPhase("awaiting-empty");
    setHistoryKey((key) => key + 1);
  }

  async function nextPieceByTouch(): Promise<void> {
    setSettingsOpen(false);
    await nextPiece();
    if (!voice.speakCue("lift-pot", LINES.liftPot)) showToast(LINES.liftPot);
  }

  async function reportTrueSize(dimension: "height" | "width", trueMm: number) {
    const value = dimension === "height" ? sized?.height : sized?.maximumWidth;
    const appMm = value ?? null;
    props.onCorrection({
      atMs: Date.now(),
      dimension,
      trueMm,
      appMm,
      confidence: reading?.confidence.overall ?? null,
      handsLikely: pipeline.handsLikely,
    });
    return { appMm };
  }

  // When the camera is interrupted (app switch, lock screen), try once to resume without a tap as soon
  // as the page is visible again; if that fails, say out loud that one tap is needed.
  const resumeTriedRef = useRef(false);
  useEffect(() => {
    if (!camera.interrupted) {
      resumeTriedRef.current = false;
      return;
    }
    const tryResume = () => {
      if (document.visibilityState !== "visible" || resumeTriedRef.current) return;
      resumeTriedRef.current = true;
      void startCamera().then((resumed) => {
        if (!resumed) speakNotice(NOTICES.cameraStopped);
      });
    };
    tryResume();
    document.addEventListener("visibilitychange", tryResume);
    return () => document.removeEventListener("visibilitychange", tryResume);
    // startCamera is stable enough here: it only reads refs and the camera hook.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.interrupted]);

  async function startCamera(): Promise<boolean> {
    const settings = await camera.start();
    if (!settings) return false;
    props.onCameraReady();
    if (!cameraOnly && videoRef.current) pipeline.start(videoRef.current);
    window.setTimeout(() => {
      if (videoRef.current) plateRef.current = safeCapture(videoRef.current);
    }, PLATE_STILL_DELAY_MS);
    return true;
  }

  async function switchCamera(): Promise<void> {
    const settings = await camera.switchFacing();
    if (!settings) return;
    if (!cameraOnly && videoRef.current) pipeline.start(videoRef.current, { freshBackground: true });
    // A different lens sees the wheel from a different place: the scale no longer applies.
    applyScale(null);
    setup.setCalibration("none");
    plateRef.current = null;
  }

  function applyScale(next: SessionScale | null, imageCenterlineX?: number): void {
    setScaleState(next);
    pipeline.setScale(next, imageCenterlineX);
    props.onScale(next);
  }

  function updateWheel(next: WheelCheckState | null): void {
    wheelRef.current = next;
    setWheelCheck(next);
    // The edge check is shown over the video, so get the settings sheet out of its way.
    if (next) setSettingsOpen(false);
  }

  async function checkWheel(fresh: boolean) {
    const video = videoRef.current;
    if (!video) return { found: false, confidence: 0, problem: "The camera isn't running." };
    const image = fresh || !plateRef.current ? safeCapture(video) : plateRef.current;
    if (!image) return { found: false, confidence: 0, problem: "The camera hasn't shown a picture yet." };
    plateRef.current = image;
    const gray = toGray(image.data, image.width, image.height);
    const found = detectWheelHead(gray);
    const toFull = (value: number) => Math.round((value + 0.5) * gray.scale);
    const detection = { ...found, leftX: toFull(found.leftX), rightX: toFull(found.rightX), row: toFull(found.row) };
    updateWheel({ image, detection, edges: { left: detection.leftX, right: detection.rightX }, adjusted: false });
    setup.setCalibration("checking");
    setProblem(null);
    return { found: detection.confidence >= 0.5, confidence: Math.round(detection.confidence * 100) / 100 };
  }

  function adjustWheel(side: "left" | "right", direction: "in" | "out", size: "small" | "large"): void {
    const current = wheelRef.current;
    if (!current) return;
    updateWheel({
      ...current,
      edges: nudgeMarker(current.edges, side, direction, size, current.image.width),
      adjusted: true,
    });
  }

  function confirmWheel(): { accepted: boolean; problems: string[] } {
    const current = wheelRef.current;
    const diameter = setup.getSnapshot().wheelHeadDiameterMm;
    if (!current || !diameter?.confirmed) return { accepted: false, problems: ["Check the wheel head first."] };
    const result = wheelHeadCalibration({
      leftX: current.edges.left,
      rightX: current.edges.right,
      row: current.detection.row,
      diameterMm: diameter.value,
      frameWidth: current.image.width,
      frameHeight: current.image.height,
      adjustedByUser: current.adjusted,
    });
    if (result.status !== "accepted") {
      const problems = result.reasons.map(describeCalibrationReason);
      setProblem(problems.join(" "));
      return { accepted: false, problems };
    }
    applyScale(scaleFromCalibration(result), result.imageCenterlineX);
    setup.setCalibration("confirmed");
    updateWheel(null);
    return { accepted: true, problems: [] };
  }

  function skipWheel(): void {
    updateWheel(null);
    setup.setCalibration("skipped");
  }

  async function runBoardCalibration(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setProblem(null);
    try {
      const active = detector ?? new WasmTagDetector();
      if (!detector) setDetector(active);
      setBoardCandidate(await calibrateFromVideo(video, active));
    } catch (error) {
      setProblem(
        `Calibration failed: ${error instanceof Error ? error.message : "keep all four tags visible and retry."}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function acceptBoard(accepted: CalibrationResult): void {
    setBoardCandidate(null);
    setBoardMode(false);
    applyScale(scaleFromCalibration(accepted));
    setup.setCalibration("confirmed");
  }

  function loadDemo(): void {
    setup.apply({ wheelHeadDiameter: { value: 14, unit: "in" } });
    const calibration = demoCalibration(camera.settings?.width, camera.settings?.height);
    applyScale(scaleFromCalibration(calibration));
    setup.setCalibration("confirmed");
    pipeline.injectReading(demoReading());
    // Keep the demo reading fresh so live cues treat it as current.
    if (demoTimerRef.current === null)
      demoTimerRef.current = window.setInterval(() => pipeline.injectReading(demoReading()), 500);
  }

  async function markMoment() {
    const moment = await props.onMarkMoment();
    setMomentMarked(true);
    return moment;
  }

  // Keep the voice tools pointed at this session's latest state. This only assigns a ref (it hands
  // the setter over without calling it), so it runs after every render without dependencies.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    toolBridge.current = {
      getReading: () => pipeline.stableReading,
      getScale: () => activeScale,
      getWobble: () => (activeScale ? pipeline.wobbleReading : null),
      getTarget: () => target,
      getGoal: () => goal,
      wheel: { check: checkWheel, adjust: adjustWheel, confirm: confirmWheel, skip: skipWheel },
      setPaused,
      markMoment: ({ label }) => markMoment().then((moment) => (label ? { ...moment, label } : moment)),
      endSession: () => props.onEnd({ byVoice: true }),
      nextPiece,
      reportTrueSize,
    };
  });

  const calibrationArea = (
    <div className="calibration-area">
      {problem && <p role="alert">{problem}</p>}
      {wheelCheck ? null : boardCandidate ? (
        <CalibrationFlow
          result={boardCandidate}
          onAccepted={acceptBoard}
          onRecalibrate={() => setBoardCandidate(null)}
        />
      ) : slots.calibration !== "confirmed" && slots.calibration !== "skipped" && camera.active ? (
        boardMode ? (
          <section className="calibration-actions" aria-label="Printed board calibration">
            <p>
              Print the{" "}
              <a href="/calibration/board-v1.svg" target="_blank" rel="noreferrer">
                calibration board
              </a>{" "}
              at 100% scale, stand it beside the pot facing the camera, then calibrate.
            </p>
            <button type="button" disabled={busy} onClick={() => void runBoardCalibration()}>
              {busy ? "Detecting board…" : "Calibrate printed board"}
            </button>
            <button type="button" className="link-button" onClick={() => setBoardMode(false)}>
              Use the wheel head instead
            </button>
          </section>
        ) : (
          <section className="calibration-actions" aria-label="Wheel-head calibration">
            <WheelHeadStep
              initialDiameterMm={slots.wheelHeadDiameterMm?.value ?? loadRememberedDiameterMm()}
              busy={busy}
              onFind={(diameterMm) => {
                setup.apply({ wheelHeadDiameter: { value: diameterMm, unit: "mm" } });
                void checkWheel(false);
              }}
            />
            <button type="button" className="link-button" onClick={() => setBoardMode(true)}>
              Use a printed board instead
            </button>
            <button type="button" className="secondary" onClick={skipWheel}>
              Skip sizes (shape only)
            </button>
            {demoMode && (
              <button type="button" className="secondary" onClick={loadDemo}>
                Load deterministic demo calibration
              </button>
            )}
          </section>
        )
      ) : null}
    </div>
  );

  return (
    <section className="live-session" aria-labelledby="live-title">
      <h1 id="live-title" className="visually-hidden">
        Live session
      </h1>
      <div className="live-stage">
        <video
          ref={videoRef}
          className={mirrored ? "mirrored" : undefined}
          muted
          playsInline
          aria-label={camera.facing === "user" ? "Front camera preview" : "Rear camera preview"}
        />
        <div className="stage-top">
          <LiveReadouts reading={reading} sized={sized} goal={goal} />
          <div className="stage-buttons">
            <button
              type="button"
              className="icon-button"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-controls="session-settings"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <span aria-hidden="true">⚙</span>
            </button>
            <button
              type="button"
              className="icon-button end"
              aria-label="End session"
              onClick={() => setConfirmingEnd(true)}
            >
              <span aria-hidden="true">■</span>
            </button>
          </div>
        </div>
        <div className="stage-banners">
          {camera.error && <p role="alert">{camera.error}</p>}
          {camera.interrupted && (
            <div role="alert" className="stale-banner">
              The camera stopped. Tap here once when your hands are clean.
              <button type="button" onClick={() => void startCamera()}>
                Resume camera
              </button>
            </div>
          )}
          {momentMarked && <p role="status">Moment marked locally.</p>}
          {/* While settings are open, only the alerts above stay on top of the sheet. */}
          {!settingsOpen && (
            <>
              {paused && <p className="stale-banner">Coaching is paused. Say "resume" to carry on.</p>}
              {sizesEnabled && props.measurementsUnverified && (
                <p className="stale-banner">Prototype: measurements are unverified and may be wrong.</p>
              )}
              {!sizesEnabled && <p className="stale-banner">Sizes are disabled until the measurement gate passes.</p>}
              {camera.active && wheelPhase === "learning" && (
                <p role="status">Looking at the empty wheel… keep it clear for a moment.</p>
              )}
              {wheelPhase === "ready" && <p role="status">Got the empty wheel. Put your clay on.</p>}
              {wheelPhase === "awaiting-empty" && (
                <p role="status">Lift the pot off; I'll look at the empty wheel again.</p>
              )}
              {cueToast && (
                <p role="status" className="cue-toast">
                  {cueToast}
                </p>
              )}
            </>
          )}
        </div>
        {wheelCheck && (
          // Shown over the video, not in settings: the coach asks about these lines.
          <div className="stage-panel">
            <WheelHeadConfirm
              still={wheelCheck.image}
              detection={wheelCheck.detection}
              edges={wheelCheck.edges}
              onEdgesChange={(edges) => updateWheel({ ...wheelCheck, edges, adjusted: true })}
              mirrored={mirrored}
              onConfirm={() => void confirmWheel()}
              onRetry={() => updateWheel(null)}
            />
          </div>
        )}
        <div className="stage-bottom">
          {voice.available && <Captions state={voice.state} failure={voice.failure} captions={voice.captions} />}
          {camera.active && (
            <p className="capture-indicator" role="status">
              Camera active · frames stay on this device
            </p>
          )}
        </div>
      </div>

      {settingsOpen && (
        <section id="session-settings" className="settings-sheet" aria-label="Session settings">
          <div className="sheet-header">
            <h2>{props.pieceNumber > 0 ? `Settings · piece ${props.pieceNumber}` : "Settings"}</h2>
            <button type="button" className="secondary" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <SetupChecklist
            slots={slots}
            templates={TEMPLATES}
            calibration={calibrationArea}
            onTargetChange={(targetId) => setup.apply({ targetId })}
            onGoal={(value) =>
              setup.apply({
                goal: {
                  height: { value: value.goal.desiredHeightMm, unit: "mm" },
                  basis: value.goal.basis,
                  shrinkagePercent: value.goal.shrinkageFraction === null ? null : value.goal.shrinkageFraction * 100,
                },
              })
            }
          />
          {reading && (
            <section className="live-target" aria-label={sized ? "Live target comparison" : "Live shape comparison"}>
              <ProfileOverlay target={target} reading={sized ?? reading} mode={sized ? "millimetres" : "normalized"} />
              {comparison && sized && goal && (
                <GoalProgress
                  comparison={comparison}
                  heightProgress={(sized.height ?? 0) / goal.wetHeightMm}
                  onMilestone={props.onMilestone}
                />
              )}
            </section>
          )}
          {activeScale && pipeline.wobbleReading && <StabilityStatus reading={pipeline.wobbleReading} />}
          <div className="session-actions">
            <button type="button" onClick={() => void nextPieceByTouch()}>
              Next piece
            </button>
            <button type="button" className="secondary" onClick={() => void markMoment()}>
              Mark this moment
            </button>
            {camera.active && (
              <button
                type="button"
                className="secondary"
                disabled={camera.starting}
                onClick={() => void switchCamera()}
              >
                {camera.facing === "user" ? "Use rear camera" : "Use front camera"}
              </button>
            )}
          </div>
          <NotesPanel notes={props.lastingNotes} onForget={props.onForgetNote} />
          <HistoryPanel throwLog={props.throwLog} refreshKey={historyKey} />
          {camera.active && <DiagnosticsPanel sample={pipeline.sample} />}
        </section>
      )}

      {confirmingEnd && (
        <div className="end-confirm" role="alertdialog" aria-labelledby="end-confirm-title">
          <h2 id="end-confirm-title">End this session?</h2>
          <p>The camera stops and you'll see the review.</p>
          <div className="session-actions">
            <button type="button" onClick={() => void props.onEnd()}>
              End session and review
            </button>
            <button type="button" className="secondary" onClick={() => setConfirmingEnd(false)}>
              Keep going
            </button>
          </div>
        </div>
      )}

      {(voice.failure === "unavailable" || voice.failure === "time-limit") && (
        // The one tap a lost connection needs: the whole screen is the target, reachable with a knuckle.
        <button type="button" className="tap-anywhere" onClick={() => void voice.restart()}>
          {voice.failure === "time-limit"
            ? "Voice coach hung up after an hour. Tap anywhere once to keep talking."
            : "Voice coach lost. Tap anywhere once to reconnect."}
        </button>
      )}
    </section>
  );
}

function safeCapture(video: HTMLVideoElement): ImageData | null {
  try {
    return captureFrame(video);
  } catch {
    return null;
  }
}
