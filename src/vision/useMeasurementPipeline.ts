import { useEffect, useRef, useState } from "react";
import { CanvasFrameSource } from "../camera/CanvasFrameSource";
import type { SessionScale } from "../measurement/scale";
import { FrameDiagnostics, type DiagnosticSample } from "../diagnostics/FrameDiagnostics";
import type { StableDimensionReading } from "../measurement/types";
import { AdaptiveRateController, type AdaptiveMode, type ProcessingRate } from "../performance/AdaptiveRateController";
import { useLatest } from "../shared/useLatest";
import type { WobbleReading } from "../wobble/types";
import type { BackgroundModel } from "./backgroundModel";
import { BoundedWorkerSink, type MeasurementWorkerEvent, type MeasurementWorkerRequest } from "./workerProtocol";
import type { DatasetFrameCapture } from "./workerProtocol";
import { DatasetCaptureRequests } from "./datasetCaptureRequests";

export type MeasurementCallbacks = {
  onReading?(reading: StableDimensionReading): void;
  onWobble?(reading: WobbleReading): void;
  onProcessingModeChange?(mode: AdaptiveMode): void;
  /** The empty wheel has been learned (at the start, and after each `resetBackground`). */
  onBackgroundReady?(): void;
};

type Pipeline = {
  worker: Worker;
  sink: BoundedWorkerSink;
  source: CanvasFrameSource;
  video: HTMLVideoElement;
  previewHandle: number | null;
};

/**
 * Runs the off-main-thread measurement pipeline for a playing video: frame sampling, the bounded
 * worker hand-off, diagnostics, and adaptive rate control. The confirmed calibration is remembered
 * and re-sent whenever the pipeline restarts (for example after a camera interruption).
 */
const STALL_RESTART_SECONDS = 4;

export function useMeasurementPipeline(callbacks: MeasurementCallbacks = {}) {
  const latest = useLatest(callbacks);
  const [diagnostics] = useState(() => new FrameDiagnostics());
  const [sample, setSample] = useState<DiagnosticSample>(() => diagnostics.snapshot(0));
  const [stableReading, setStableReading] = useState<StableDimensionReading | null>(null);
  const [wobbleReading, setWobbleReading] = useState<WobbleReading | null>(null);
  const [processingHz, setProcessingHz] = useState<ProcessingRate>(10);
  const pipelineRef = useRef<Pipeline | null>(null);
  const scaleRef = useRef<{ scale: SessionScale | null; imageCenterlineX?: number }>({ scale: null });
  const pinnedRef = useRef(false);
  const backgroundRef = useRef<BackgroundModel | null>(null);
  const [handsLikely, setHandsLikely] = useState(false);
  const [vesselVisible, setVesselVisible] = useState(false);
  const captureRequestsRef = useRef(new DatasetCaptureRequests());

  function start(video: HTMLVideoElement, { freshBackground = false }: { freshBackground?: boolean } = {}): void {
    captureRequestsRef.current.rejectPending("Measurement pipeline restarted");
    if (freshBackground) backgroundRef.current = null;
    teardown(pipelineRef.current);
    pipelineRef.current = null;
    diagnostics.reset();
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function") return;
    const worker = new Worker(new URL("./measurement.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<MeasurementWorkerEvent>) => {
      const message = event.data;
      if (message?.type === "background-ready") {
        backgroundRef.current = message.model;
        latest.current.onBackgroundReady?.();
      }
      if (message?.type === "reading") {
        diagnostics.record("rendered", performance.now(), message.instantaneous.sourceFrameId);
        setHandsLikely(message.instantaneous.handsLikely === true);
        setVesselVisible(message.instantaneous.height !== null);
        if (message.stable && !pinnedRef.current) {
          setStableReading(message.stable);
          latest.current.onReading?.(message.stable);
        }
      }
      if (message?.type === "invalidated" && !pinnedRef.current) setStableReading(null);
      if (message?.type === "wobble") {
        setWobbleReading(message.reading);
        latest.current.onWobble?.(message.reading);
      }
      if (message?.type === "dataset-capture") captureRequestsRef.current.resolve(message.capture);
    });
    const sink = new BoundedWorkerSink(worker, (diagnostic) =>
      diagnostics.record("processed", performance.now(), diagnostic.frameId),
    );
    const source = new CanvasFrameSource();
    source.start(
      video,
      {
        targetFps: processingHz,
      },
      (frame) => {
        diagnostics.record("acquired", performance.now(), frame.frameId);
        const result = sink.submit(frame);
        if (result === "busy") diagnostics.recordDropped();
        return result;
      },
    );
    const pipeline: Pipeline = { worker, sink, source, video, previewHandle: null };
    if (typeof video.requestVideoFrameCallback === "function") {
      const tick: VideoFrameRequestCallback = (now) => {
        diagnostics.record("preview", now);
        pipeline.previewHandle = video.requestVideoFrameCallback(tick);
      };
      pipeline.previewHandle = video.requestVideoFrameCallback(tick);
    }
    pipelineRef.current = pipeline;
    if (backgroundRef.current) post({ type: "background", model: backgroundRef.current });
    if (scaleRef.current.scale) post({ type: "scale", ...scaleRef.current });
  }

  /** Forgets the empty-wheel background and learns it again (next piece); the scale is kept. */
  function resetBackground(): void {
    backgroundRef.current = null;
    post({ type: "reset", reason: "next-piece" });
    if (scaleRef.current.scale) post({ type: "scale", ...scaleRef.current });
  }

  function stop(): void {
    captureRequestsRef.current.rejectPending("Measurement pipeline stopped");
    teardown(pipelineRef.current);
    pipelineRef.current = null;
    diagnostics.reset();
    pinnedRef.current = false;
    backgroundRef.current = null;
    setStableReading(null);
    setWobbleReading(null);
  }

  /**
   * Sets (or clears) the session scale. Readings keep flowing in pixels either way; the worker only
   * needs the scale for wobble, which is judged in millimetres, and the wheel centreline.
   */
  function setScale(scale: SessionScale | null, imageCenterlineX?: number): void {
    scaleRef.current = { scale, imageCenterlineX };
    if (!scale) {
      pinnedRef.current = false;
      setWobbleReading(null);
    }
    post({ type: "scale", scale, imageCenterlineX });
  }

  /** Shows a fixed reading (demo sessions) that live worker output will not replace until reset. */
  function injectReading(reading: StableDimensionReading): void {
    pinnedRef.current = true;
    setStableReading(reading);
    latest.current.onReading?.(reading);
  }

  function captureDatasetFrame(): Promise<DatasetFrameCapture> {
    if (!pipelineRef.current) return Promise.reject(new Error("The camera measurement pipeline is not running"));
    const pending = captureRequestsRef.current.request();
    post({ type: "request-dataset-capture", captureId: pending.captureId });
    return pending.promise;
  }

  function post(message: MeasurementWorkerRequest): void {
    pipelineRef.current?.worker.postMessage(message);
  }

  const restartRef = useLatest(start);

  useEffect(() => {
    const adaptive = new AdaptiveRateController((mode) => {
      setProcessingHz(mode.processingHz);
      diagnostics.setTargetFps(mode.processingHz);
      pipelineRef.current?.source.updateOptions({ targetFps: mode.processingHz });
      latest.current.onProcessingModeChange?.(mode);
    });
    void readBatteryLevel(diagnostics);
    let idleSeconds = 0;
    const interval = window.setInterval(() => {
      const next = diagnostics.snapshot();
      setSample(next);
      const pipeline = pipelineRef.current;
      if (!pipeline) return;
      adaptive.update({ processingMsP95: next.workerProcessingMsP95, frameAgeMsP95: next.frameAgeMsP95 });
      // Self-heal: if nothing has been processed for a while, the worker crashed or stalled. Restarting
      // it costs a few frames of background learning, which beats silently losing measurement.
      idleSeconds = next.processedFps === 0 ? idleSeconds + 1 : 0;
      if (idleSeconds >= STALL_RESTART_SECONDS) {
        idleSeconds = 0;
        restartRef.current(pipeline.video);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
      captureRequestsRef.current.rejectPending("Measurement pipeline unmounted");
      teardown(pipelineRef.current);
      pipelineRef.current = null;
    };
  }, [diagnostics, latest, restartRef]);

  return {
    sample,
    stableReading,
    wobbleReading,
    handsLikely,
    vesselVisible,
    processingHz,
    start,
    stop,
    setScale,
    injectReading,
    resetBackground,
    captureDatasetFrame,
  };
}

function teardown(pipeline: Pipeline | null): void {
  if (!pipeline) return;
  pipeline.source.stop();
  pipeline.sink.dispose();
  pipeline.worker.terminate();
  if (pipeline.previewHandle !== null) pipeline.video.cancelVideoFrameCallback?.(pipeline.previewHandle);
}

async function readBatteryLevel(diagnostics: FrameDiagnostics): Promise<void> {
  const getBattery = (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery;
  if (!getBattery) return;
  try {
    diagnostics.setBatteryLevel((await getBattery.call(navigator)).level);
  } catch {
    diagnostics.setBatteryLevel(null);
  }
}
