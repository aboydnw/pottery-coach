import { useEffect, useMemo, useRef, useState } from "react";

import type { SessionStep } from "../app/AppSessionOrchestrator";
import { demoCalibration, demoReading } from "../app/demoFixtures";
import { CalibrationFlow } from "../calibration/CalibrationFlow";
import { calibrateFromVideo } from "../calibration/calibrateFromVideo";
import type { CalibrationResult } from "../calibration/types";
import { WasmTagDetector } from "../calibration/WasmTagDetector";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";
import type { GoalConfirmation } from "../goals/types";
import type { StableDimensionReading } from "../measurement/types";
import type { AdaptiveMode } from "../performance/AdaptiveRateController";
import { compareProfiles } from "../targets/compareProfiles";
import { GoalProgress } from "../targets/GoalProgress";
import { loadTemplates } from "../targets/loadTemplates";
import { ProfileOverlay } from "../targets/ProfileOverlay";
import { TargetSetup } from "../targets/TargetSetup";
import { useMeasurementPipeline } from "../vision/useMeasurementPipeline";
import { MockRealtimeTransport } from "../voice/MockRealtimeTransport";
import { VoiceChoice } from "../voice/VoiceChoice";
import { VoiceControls } from "../voice/VoiceControls";
import { StabilityStatus } from "../wobble/StabilityStatus";
import type { WobbleReading } from "../wobble/types";
import { useCamera } from "./useCamera";

export type CameraSetupProps = {
  /** Current step from the session state machine; it decides which panels are shown. */
  step?: SessionStep;
  numericEnabled?: boolean;
  demoMode?: boolean;
  cameraOnly?: boolean;
  onCameraReady?(): void;
  onCameraDenied?(): void;
  onCameraStopped?(): void;
  onCalibrated?(): void;
  onRecalibrate?(): void;
  onAudioDecided?(enabled: boolean): void;
  onGoalSet?(goal: GoalConfirmation): void;
  onGoalCleared?(): void;
  onReading?(reading: StableDimensionReading): void;
  onWobble?(reading: WobbleReading): void;
  onMilestone?(percent: number, evidenceId: string): void;
  onProcessingModeChange?(mode: AdaptiveMode): void;
  onMarkMoment?(): void | Promise<void>;
  onEnded?(): void;
};

const TARGET_TEMPLATES = loadTemplates();
const CALIBRATED_STEPS: readonly SessionStep[] = ["audio-consent", "goal", "live"];

/** The live camera journey: camera, calibration, voice choice, target, and the live session view. */
export function CameraSetup(props: CameraSetupProps) {
  const { step = "camera", numericEnabled = true, demoMode = false, cameraOnly = false } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef, { onDenied: props.onCameraDenied });
  const pipeline = useMeasurementPipeline({ onReading: props.onReading, onWobble: props.onWobble, onProcessingModeChange: props.onProcessingModeChange });
  const [detector, setDetector] = useState<WasmTagDetector | null>(null);
  const [candidate, setCandidate] = useState<CalibrationResult | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [voiceTransport, setVoiceTransport] = useState<MockRealtimeTransport | null>(null);
  const [targetId, setTargetId] = useState(TARGET_TEMPLATES[0]!.id);
  const [goal, setGoal] = useState<GoalConfirmation | null>(null);
  const [demoAnswer, setDemoAnswer] = useState<string | null>(null);
  const [momentMarked, setMomentMarked] = useState(false);
  const processing = numericEnabled && !cameraOnly;

  const selectedTarget = TARGET_TEMPLATES.find((template) => template.id === targetId) ?? TARGET_TEMPLATES[0]!;
  const scaledTarget = useMemo(() => goal ? { ...selectedTarget, intendedWetHeightMm: goal.wetHeightMm } : selectedTarget, [goal, selectedTarget]);
  const reading = pipeline.stableReading;
  const comparison = useMemo(() => reading && goal ? compareProfiles(reading, scaledTarget) : null, [reading, goal, scaledTarget]);

  useEffect(() => () => detector?.dispose(), [detector]);
  useEffect(() => () => void voiceTransport?.close(), [voiceTransport]);

  async function startCamera(): Promise<void> {
    const settings = await camera.start();
    if (!settings) return;
    if (step === "camera") props.onCameraReady?.();
    if (processing && videoRef.current) pipeline.start(videoRef.current, settings);
  }

  function stopCamera(): void {
    pipeline.stop();
    pipeline.configure(null);
    camera.stop();
    setCandidate(null);
    setGoal(null);
    setVoiceTransport(null);
    props.onCameraStopped?.();
  }

  async function runCalibration(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;
    setCalibrating(true);
    setCalibrationError(null);
    try {
      const active = detector ?? new WasmTagDetector();
      if (!detector) setDetector(active);
      setCandidate(await calibrateFromVideo(video, active));
    } catch (error) {
      setCalibrationError(`Calibration failed: ${error instanceof Error ? error.message : "keep all four tags visible and retry."}`);
    } finally {
      setCalibrating(false);
    }
  }

  function loadDemoCalibration(): void {
    setCandidate(demoCalibration(camera.settings?.width, camera.settings?.height));
    pipeline.injectReading(demoReading());
  }

  function acceptCalibration(accepted: CalibrationResult): void {
    setCandidate(null);
    pipeline.configure(accepted);
    props.onCalibrated?.();
  }

  function recalibrate(): void {
    pipeline.configure(null);
    setGoal(null);
    props.onRecalibrate?.();
  }

  async function startMockVoice(): Promise<void> {
    const transport = new MockRealtimeTransport();
    await transport.connect({ provider: "mock", model: "mock-v1", voice: "local", language: "en", instructionsRevision: "instructions-v1", toolsRevision: "tools-v1" });
    setVoiceTransport(transport);
    props.onAudioDecided?.(true);
  }

  function changeTarget(next: string): void {
    setTargetId(next);
    if (goal) {
      setGoal(null);
      props.onGoalCleared?.();
    }
  }

  function confirmGoal(value: GoalConfirmation): void {
    setGoal(value);
    props.onGoalSet?.(value);
  }

  function endSession(): void {
    pipeline.stop();
    camera.stop();
    setVoiceTransport(null);
    props.onEnded?.();
  }

  async function markMoment(): Promise<void> {
    await props.onMarkMoment?.();
    setMomentMarked(true);
  }

  const calibrated = CALIBRATED_STEPS.includes(step);
  const live = step === "live" && goal !== null;

  return (
    <section className="camera-setup" aria-labelledby="camera-title">
      <p className="eyebrow">Private setup</p>
      <h1 id="camera-title">Set your camera beside the wheel.</h1>
      <p>
        Video is processed locally on this device. Raw frames are not stored or
        uploaded. Microphone access is requested separately, later.
      </p>

      <video ref={videoRef} autoPlay muted playsInline aria-label="Rear camera preview" />

      {camera.error && <p role="alert">{camera.error}</p>}
      {calibrationError && <p role="alert">{calibrationError}</p>}
      {camera.settings && (
        <p aria-live="polite">
          Camera delivering {camera.settings.width ?? "unknown"} × {camera.settings.height ?? "unknown"}
          {camera.settings.frameRate ? ` at ${Math.round(camera.settings.frameRate)} fps` : ""}.
        </p>
      )}
      {camera.active && <p className="capture-indicator" role="status">Camera active · frames stay on this device</p>}
      {camera.active && processing && <p>Vision processing target: {pipeline.processingHz} Hz. Preview quality is unchanged.</p>}
      {camera.active && !numericEnabled && <p>Numeric measurements are disabled until the signed physical calibration gate passes.</p>}
      {camera.interrupted && (
        <div role="status" className="stale-banner">
          Camera was interrupted. Readings are stale until you resume.
          <button type="button" onClick={() => void startCamera()}>Resume camera</button>
        </div>
      )}

      {camera.active && <DiagnosticsPanel sample={pipeline.sample} />}
      {camera.active && step === "calibration" && !candidate && (
        <div className="calibration-actions">
          <a href="/calibration/board-v1.svg" target="_blank" rel="noreferrer">Open printable calibration board</a>
          <button type="button" className="secondary" disabled={calibrating} onClick={() => void runCalibration()}>
            {calibrating ? "Detecting board…" : "Calibrate printed board"}
          </button>
          {demoMode && <button type="button" className="secondary" onClick={loadDemoCalibration}>Load deterministic demo calibration</button>}
        </div>
      )}
      {candidate && <CalibrationFlow result={candidate} onAccepted={acceptCalibration} onRecalibrate={() => setCandidate(null)} />}
      {camera.active && calibrated && <button type="button" className="secondary" onClick={recalibrate}>Recalibrate</button>}
      {camera.active && step === "audio-consent" && <VoiceChoice onMockVoice={() => void startMockVoice()} onNoVoice={() => props.onAudioDecided?.(false)} />}
      {camera.active && (step === "goal" || step === "live") && (
        <TargetSetup templates={TARGET_TEMPLATES} targetId={targetId} onTargetChange={changeTarget} onGoalConfirmed={confirmGoal} />
      )}
      {live && reading && comparison && (
        <section className="live-target" aria-label="Live target comparison">
          <ProfileOverlay target={scaledTarget} reading={reading} mode="millimetres" />
          <GoalProgress comparison={comparison} heightProgress={(reading.heightMm ?? 0) / goal.wetHeightMm} onMilestone={props.onMilestone} />
        </section>
      )}
      {live && pipeline.wobbleReading && <StabilityStatus reading={pipeline.wobbleReading} />}
      {voiceTransport && <VoiceControls transport={voiceTransport} connectionLabel="local mock (no provider audio)" />}
      {demoMode && live && reading && (
        <section aria-label="Demo evidence question">
          <button type="button" className="secondary" onClick={() => setDemoAnswer(`Height is ${reading.heightMm} mm · evidence ${reading.id}`)}>Ask “How tall is it?”</button>
          {demoAnswer && <p role="status">{demoAnswer}</p>}
        </section>
      )}
      {live && (
        <div className="session-actions">
          <button type="button" className="secondary" onClick={() => void markMoment()}>Mark this moment</button>
          <button type="button" onClick={endSession}>End session and review</button>
        </div>
      )}
      {momentMarked && <p role="status">Moment marked locally.</p>}

      <div className="actions">
        {!camera.active ? (
          <button type="button" disabled={camera.starting} onClick={() => void startCamera()}>
            {camera.starting ? "Starting camera…" : "Start camera"}
          </button>
        ) : (
          <button type="button" onClick={stopCamera}>Stop camera</button>
        )}
        {camera.error && <button type="button" className="secondary" onClick={() => void startCamera()}>Retry</button>}
      </div>
      {camera.active && (
        <button type="button" className="secondary" onClick={() => downloadDiagnostics(pipeline.sample)}>
          Download diagnostics
        </button>
      )}
    </section>
  );
}

function downloadDiagnostics(sample: unknown): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(sample)}\n`], { type: "application/x-ndjson" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pottery-camera-diagnostics-${Date.now()}.jsonl`;
  anchor.click();
  URL.revokeObjectURL(url);
}
