import { useEffect, useRef, useState } from "react";

import { CameraController } from "./CameraController";
import { CanvasFrameSource } from "./CanvasFrameSource";
import type { CameraSettings } from "./types";
import { BoundedWorkerSink } from "../vision/workerProtocol";
import { FrameDiagnostics, type DiagnosticSample } from "../diagnostics/FrameDiagnostics";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";

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
  const [settings, setSettings] = useState<CameraSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [sample, setSample] = useState<DiagnosticSample>(() =>
    diagnosticsRef.current.snapshot(0),
  );

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
