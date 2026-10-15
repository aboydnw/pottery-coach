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
import { StabilityStatus } from "../wobble/StabilityStatus";
import type { WobbleReading } from "../wobble/types";
import { Captions } from "./Captions";
import { LiveReadouts } from "./LiveReadouts";
import { SetupChecklist } from "./SetupChecklist";

const TEMPLATES = loadTemplates();
/** Wait for the camera's exposure to settle before keeping the empty-wheel reference still. */
const PLATE_STILL_DELAY_MS = 700;

type WheelCheckState = { image: ImageData; detection: WheelHeadDetection; edges: WheelEdges; adjusted: boolean };

export type LiveSessionProps = {
  setup: SetupStore;
  /** Filled with the live parts of the voice tools while this session is on screen. */
  toolBridge: MutableRefObject<Partial<ToolDependencies>>;
  voice: { available: boolean; state: string; captions: Caption[] };
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
  onEnd(): void;
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
  const plateRef = useRef<ImageData | null>(null);
  const wheelRef = useRef<WheelCheckState | null>(null);
  const startedRef = useRef(false);

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
    if (startedRef.current) return;
    startedRef.current = true;
    void startCamera();
    // Start exactly once, right after the session's single tap.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => detector?.dispose(), [detector]);

  async function startCamera(): Promise<void> {
    const settings = await camera.start();
    if (!settings) return;
    props.onCameraReady();
    if (!cameraOnly && videoRef.current) pipeline.start(videoRef.current, settings);
    window.setTimeout(() => {
      if (videoRef.current) plateRef.current = safeCapture(videoRef.current);
    }, PLATE_STILL_DELAY_MS);
  }

  async function switchCamera(): Promise<void> {
    const settings = await camera.switchFacing();
    if (!settings) return;
    if (!cameraOnly && videoRef.current) pipeline.start(videoRef.current, settings);
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
      endSession: async () => props.onEnd(),
    };
  });

  const calibrationArea = (
    <div className="calibration-area">
      {problem && <p role="alert">{problem}</p>}
      {wheelCheck ? (
        <WheelHeadConfirm
          still={wheelCheck.image}
          detection={wheelCheck.detection}
          edges={wheelCheck.edges}
          onEdgesChange={(edges) => updateWheel({ ...wheelCheck, edges, adjusted: true })}
          mirrored={mirrored}
          onConfirm={() => void confirmWheel()}
          onRetry={() => updateWheel(null)}
        />
      ) : boardCandidate ? (
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
              initialDiameterMm={slots.wheelHeadDiameterMm?.value ?? null}
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
      {camera.error && <p role="alert">{camera.error}</p>}
      {camera.interrupted && (
        <div role="alert" className="stale-banner">
          The camera stopped. Tap here once when your hands are clean.
          <button type="button" onClick={() => void startCamera()}>
            Resume camera
          </button>
        </div>
      )}
      {paused && <p className="stale-banner">Coaching is paused. Say "resume" to carry on.</p>}
      {sizesEnabled && props.measurementsUnverified && (
        <p className="stale-banner">Prototype: measurements are unverified and may be wrong.</p>
      )}
      {!sizesEnabled && <p>Sizes are disabled until the measurement gate passes; shapes still work.</p>}

      <div className="live-grid">
        <video
          ref={videoRef}
          className={mirrored ? "mirrored" : undefined}
          autoPlay
          muted
          playsInline
          aria-label={camera.facing === "user" ? "Front camera preview" : "Rear camera preview"}
        />
        <LiveReadouts reading={reading} sized={sized} goal={goal} />
      </div>
      {camera.active && (
        <p className="capture-indicator" role="status">
          Camera active · frames stay on this device
        </p>
      )}
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
      {voice.available && <Captions state={voice.state} captions={voice.captions} />}

      <SetupChecklist
        slots={slots}
        templates={TEMPLATES}
        defaultOpen={!voice.available}
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

      <div className="session-actions">
        <button type="button" className="secondary" onClick={() => void markMoment()}>
          Mark this moment
        </button>
        <button type="button" onClick={props.onEnd}>
          End session and review
        </button>
        {camera.active && (
          <button type="button" className="secondary" disabled={camera.starting} onClick={() => void switchCamera()}>
            {camera.facing === "user" ? "Use rear camera" : "Use front camera"}
          </button>
        )}
      </div>
      {momentMarked && <p role="status">Moment marked locally.</p>}
      {camera.active && <DiagnosticsPanel sample={pipeline.sample} />}
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
