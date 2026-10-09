import { useEffect, useMemo, useRef, useState } from "react";

import { CameraController } from "./CameraController";
import { CanvasFrameSource } from "./CanvasFrameSource";
import type { CameraSettings } from "./types";
import { BoundedWorkerSink } from "../vision/workerProtocol";
import { FrameDiagnostics, type DiagnosticSample } from "../diagnostics/FrameDiagnostics";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";
import { WasmTagDetector } from "../calibration/WasmTagDetector";
import { solveCalibration } from "../calibration/homography";
import { CalibrationFlow } from "../calibration/CalibrationFlow";
import type { CalibrationResult, PointCorrespondence } from "../calibration/types";
import type { MeasurementWorkerEvent } from "../vision/workerProtocol";
import type { StableDimensionReading } from "../measurement/types";
import { loadTemplates } from "../targets/loadTemplates";
import { GoalForm } from "../goals/GoalForm";
import type { GoalConfirmation } from "../goals/types";
import { compareProfiles } from "../targets/compareProfiles";
import { ProfileOverlay } from "../targets/ProfileOverlay";
import { GoalProgress } from "../targets/GoalProgress";

const TARGET_TEMPLATES = loadTemplates();

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was denied. Allow camera access in browser settings and retry.";
    }
    if (error.name === "NotFoundError") {
      return "No camera was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is already in use by another app.";
    }
  }
  return "The camera could not be started. Check the connection and retry.";
}

export function CameraSetup() {
  const controllerRef = useRef<CameraController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameSourceRef = useRef<CanvasFrameSource | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerSinkRef = useRef<BoundedWorkerSink | null>(null);
  const diagnosticsRef = useRef(new FrameDiagnostics());
  const wakeLockRef = useRef<{ release(): Promise<void> } | null>(null);
  const previewCallbackRef = useRef<number | null>(null);
  const detectorRef = useRef<WasmTagDetector | null>(null);
  const [settings, setSettings] = useState<CameraSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [sample, setSample] = useState<DiagnosticSample>(() =>
    diagnosticsRef.current.snapshot(0),
  );
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [targetId, setTargetId] = useState(TARGET_TEMPLATES[0]!.id);
  const [goal, setGoal] = useState<GoalConfirmation | null>(null);
  const [stableReading, setStableReading] = useState<StableDimensionReading | null>(null);
  const selectedTarget = TARGET_TEMPLATES.find((template) => template.id === targetId) ?? TARGET_TEMPLATES[0]!;
  const scaledTarget = useMemo(() => goal ? { ...selectedTarget, intendedWetHeightMm: goal.wetHeightMm } : selectedTarget, [goal, selectedTarget]);
  const comparison = useMemo(() => stableReading && goal ? compareProfiles(stableReading, scaledTarget) : null, [stableReading, goal, scaledTarget]);

  if (!controllerRef.current) {
    controllerRef.current = new CameraController();
  }

  useEffect(() => {
    const controller = controllerRef.current;
    const unsubscribe = controller?.subscribe((event) => {
      if (["interrupted", "muted", "ended"].includes(event.type)) {
        setInterrupted(true);
        diagnosticsRef.current.reset();
      }
    });
    const interval = window.setInterval(() => {
      setSample(diagnosticsRef.current.snapshot());
    }, 1000);
    void readBatteryLevel(diagnosticsRef.current);
    return () => {
      unsubscribe?.();
      window.clearInterval(interval);
      stopFramePipeline();
      controller?.stop();
      void wakeLockRef.current?.release();
      detectorRef.current?.dispose();
    };
  }, []);

  async function startCamera(): Promise<void> {
    setError(null);
    try {
      const result = await controllerRef.current!.start();
      if (videoRef.current) {
        videoRef.current.srcObject = result.stream;
      }
      setSettings(result.settings);
      setActive(true);
      setInterrupted(false);
      diagnosticsRef.current.reset();
      startFramePipeline(result.settings);
      await requestWakeLock();
    } catch (startError) {
      setError(cameraErrorMessage(startError));
      setActive(false);
    }
  }

  function stopCamera(): void {
    stopFramePipeline();
    controllerRef.current?.stop();
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setSettings(null);
    setCalibration(null);
    setCalibrationConfirmed(false);
    setStableReading(null);
    setInterrupted(false);
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }

  function startFramePipeline(delivered: CameraSettings): void {
    const video = videoRef.current;
    if (new URLSearchParams(window.location.search).get("mode") === "camera-only") return;
    if (!video || typeof Worker === "undefined" || typeof createImageBitmap !== "function") return;
    stopFramePipeline();
    const worker = new Worker(new URL("../vision/measurement.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent<MeasurementWorkerEvent>) => {
      if (event.data?.type === "reading" && event.data.stable) setStableReading(event.data.stable);
      if (event.data?.type === "invalidated") setStableReading(null);
    });
    const sink = new BoundedWorkerSink(worker, (diagnostic) => {
      const now = performance.now();
      diagnosticsRef.current.record("processed", now, diagnostic.frameId);
      diagnosticsRef.current.record("rendered", now, diagnostic.frameId);
    });
    const source = new CanvasFrameSource();
    source.start(
      video,
      {
        targetFps: 10,
        roi: {
          x: 0,
          y: 0,
          width: delivered.width ?? 640,
          height: delivered.height ?? 360,
        },
      },
      (frame) => {
        diagnosticsRef.current.record("acquired", frame.capturedAtMs, frame.frameId);
        return sink.submit(frame);
      },
    );
    frameSourceRef.current = source;
    workerRef.current = worker;
    workerSinkRef.current = sink;
    startPreviewClock(video);
  }

  function startPreviewClock(video: HTMLVideoElement): void {
    if (typeof video.requestVideoFrameCallback !== "function") return;
    const tick: VideoFrameRequestCallback = (now) => {
      diagnosticsRef.current.record("preview", now);
      previewCallbackRef.current = video.requestVideoFrameCallback(tick);
    };
    previewCallbackRef.current = video.requestVideoFrameCallback(tick);
  }

  function stopFramePipeline(): void {
    frameSourceRef.current?.stop();
    workerSinkRef.current?.dispose();
    workerRef.current?.terminate();
    if (previewCallbackRef.current !== null && videoRef.current?.cancelVideoFrameCallback) {
      videoRef.current.cancelVideoFrameCallback(previewCallbackRef.current);
    }
    frameSourceRef.current = null;
    workerSinkRef.current = null;
    workerRef.current = null;
    previewCallbackRef.current = null;
  }

  async function requestWakeLock(): Promise<void> {
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    }).wakeLock;
    if (!wakeLock) return;
    try {
      wakeLockRef.current = await wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }
  }

  function downloadDiagnostics(): void {
    const blob = new Blob([`${JSON.stringify(diagnosticsRef.current.snapshot())}\n`], {
      type: "application/x-ndjson",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pottery-camera-diagnostics-${Date.now()}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function runCalibration(): Promise<void> {
    const video = videoRef.current;
    if (!video || !settings) return;
    setCalibrating(true);
    setError(null);
    try {
      const width = video.videoWidth || settings.width || 640;
      const height = video.videoHeight || settings.height || 360;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas capture is unavailable");
      context.drawImage(video, 0, 0, width, height);
      const detector = detectorRef.current ?? new WasmTagDetector();
      detectorRef.current = detector;
      const detections = await detector.detect(context.getImageData(0, 0, width, height));
      const correspondences = detections.flatMap((detection) => {
        const boardCorners = boardTagCorners(detection.id);
        return boardCorners
          ? detection.corners.map((image, index) => ({ image, boardMm: boardCorners[index]! }))
          : [];
      }) as PointCorrespondence[];
      const solved = solveCalibration(
        correspondences,
        {
          revision: "board-v1",
          supportedRevision: "board-v1",
          wheelBaseline: [{ x: 45, y: 120 }, { x: 165, y: 120 }],
          wheelCenterlineXmm: 105,
          markerPlaneOffsetToleranceMm: 30,
        },
        {
          width,
          height,
          roi: { x: 0, y: 0, width, height },
          poseYawDeg: null,
          posePitchDeg: null,
          blurScore: 1,
          contrastScore: 1,
        },
      );
      setCalibration(solved);
      setCalibrationConfirmed(false);
    } catch (calibrationError) {
      setError(calibrationError instanceof Error
        ? `Calibration failed: ${calibrationError.message}`
        : "Calibration failed. Keep all four tags visible and retry.");
    } finally {
      setCalibrating(false);
    }
  }

  function acceptCalibration(accepted: CalibrationResult): void {
    setCalibration(accepted);
    setCalibrationConfirmed(true);
    workerRef.current?.postMessage({ type: "configure", calibration: accepted });
  }

  return (
    <section className="camera-setup" aria-labelledby="camera-title">
      <p className="eyebrow">Private setup</p>
      <h1 id="camera-title">Set your camera beside the wheel.</h1>
      <p>
        Video is processed locally on this device. Raw frames are not stored or
        uploaded. Microphone access is requested separately, later.
      </p>

      <video ref={videoRef} autoPlay muted playsInline aria-label="Rear camera preview" />

      {error && <p role="alert">{error}</p>}
      {settings && (
        <p aria-live="polite">
          Camera delivering {settings.width ?? "unknown"} × {settings.height ?? "unknown"}
          {settings.frameRate ? ` at ${Math.round(settings.frameRate)} fps` : ""}.
        </p>
      )}
      {interrupted && (
        <div role="status" className="stale-banner">
          Camera was interrupted. Readings are stale until you resume.
          <button type="button" onClick={startCamera}>Resume camera</button>
        </div>
      )}

      {active && <DiagnosticsPanel sample={sample} />}
      {active && (
        <div className="calibration-actions">
          <a href="/calibration/board-v1.svg" target="_blank" rel="noreferrer">Open printable calibration board</a>
          <button type="button" className="secondary" disabled={calibrating} onClick={runCalibration}>
            {calibrating ? "Detecting board…" : "Calibrate printed board"}
          </button>
        </div>
      )}
      {calibration && (
        <CalibrationFlow
          result={calibration}
          onAccepted={acceptCalibration}
          onRecalibrate={() => { setCalibration(null); setCalibrationConfirmed(false); }}
        />
      )}
      {calibrationConfirmed && (
        <section className="target-setup" aria-labelledby="target-title">
          <h2 id="target-title">Choose a target</h2>
          <label>Template
            <select value={targetId} onChange={(event) => { setTargetId(event.target.value); setGoal(null); }}>
              {TARGET_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <GoalForm targetId={targetId} onConfirm={setGoal} />
        </section>
      )}
      {goal && stableReading && comparison && (
        <section className="live-target" aria-label="Live target comparison">
          <ProfileOverlay target={scaledTarget} reading={stableReading} mode="millimetres" />
          <GoalProgress comparison={comparison} heightProgress={(stableReading.heightMm ?? 0) / goal.wetHeightMm} />
        </section>
      )}

      <div className="actions">
        {!active ? (
          <button type="button" onClick={startCamera}>
            Start camera
          </button>
        ) : (
          <button type="button" onClick={stopCamera}>
            Stop camera
          </button>
        )}
        {error && (
          <button type="button" className="secondary" onClick={startCamera}>
            Retry
          </button>
        )}
      </div>
      {active && (
        <button type="button" className="secondary" onClick={downloadDiagnostics}>
          Download diagnostics
        </button>
      )}
    </section>
  );
}

async function readBatteryLevel(diagnostics: FrameDiagnostics): Promise<void> {
  const getBattery = (navigator as Navigator & {
    getBattery?: () => Promise<{ level: number }>;
  }).getBattery;
  if (!getBattery) return;
  try {
    diagnostics.setBatteryLevel((await getBattery()).level);
  } catch {
    diagnostics.setBatteryLevel(null);
  }
}

function boardTagCorners(id: number): CalibrationResult["wheelBaseline"] | [
  { x: number; y: number }, { x: number; y: number },
  { x: number; y: number }, { x: number; y: number },
] | null {
  const origins: Record<number, { x: number; y: number }> = {
    0: { x: 10, y: 10 },
    1: { x: 174, y: 10 },
    2: { x: 10, y: 112 },
    3: { x: 174, y: 112 },
  };
  const origin = origins[id];
  if (!origin) return null;
  return [
    origin,
    { x: origin.x + 26, y: origin.y },
    { x: origin.x + 26, y: origin.y + 26 },
    { x: origin.x, y: origin.y + 26 },
  ];
}
