import { useEffect, useRef, useState } from "react";
import { CanvasFrameSource } from "../camera/CanvasFrameSource";
import type { CameraSettings } from "../camera/types";
import type { CalibrationResult } from "../calibration/types";
import { FrameDiagnostics, type DiagnosticSample } from "../diagnostics/FrameDiagnostics";
import type { StableDimensionReading } from "../measurement/types";
import { AdaptiveRateController, type AdaptiveMode, type ProcessingRate } from "../performance/AdaptiveRateController";
import { useLatest } from "../shared/useLatest";
import type { WobbleReading } from "../wobble/types";
import { BoundedWorkerSink, type MeasurementWorkerEvent, type MeasurementWorkerRequest } from "./workerProtocol";

export type MeasurementCallbacks = {
  onReading?(reading: StableDimensionReading): void;
  onWobble?(reading: WobbleReading): void;
  onProcessingModeChange?(mode: AdaptiveMode): void;
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
export function useMeasurementPipeline(callbacks: MeasurementCallbacks = {}) {
  const latest = useLatest(callbacks);
  const [diagnostics] = useState(() => new FrameDiagnostics());
  const [sample, setSample] = useState<DiagnosticSample>(() => diagnostics.snapshot(0));
  const [stableReading, setStableReading] = useState<StableDimensionReading | null>(null);
  const [wobbleReading, setWobbleReading] = useState<WobbleReading | null>(null);
  const [processingHz, setProcessingHz] = useState<ProcessingRate>(10);
  const pipelineRef = useRef<Pipeline | null>(null);
  const calibrationRef = useRef<CalibrationResult | null>(null);
  const pinnedRef = useRef(false);
  useEffect(() => {
    const adaptive = new AdaptiveRateController((mode) => {
      setProcessingHz(mode.processingHz);
      diagnostics.setTargetFps(mode.processingHz);
      pipelineRef.current?.source.updateOptions({ targetFps: mode.processingHz });
      latest.current.onProcessingModeChange?.(mode);
    });
    void readBatteryLevel(diagnostics);
    const interval = window.setInterval(() => {
      const next = diagnostics.snapshot();
      setSample(next);
      if (pipelineRef.current)
        adaptive.update({ processingMsP95: next.workerProcessingMsP95, frameAgeMsP95: next.frameAgeMsP95 });
    }, 1000);
    return () => {
      window.clearInterval(interval);
      teardown(pipelineRef.current);
      pipelineRef.current = null;
    };
  }, [diagnostics, latest]);

  function start(video: HTMLVideoElement, settings: CameraSettings): void {
    teardown(pipelineRef.current);
    pipelineRef.current = null;
    diagnostics.reset();
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function") return;
    const worker = new Worker(new URL("./measurement.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<MeasurementWorkerEvent>) => {
      const message = event.data;
      if (message?.type === "reading") {
        diagnostics.record("rendered", performance.now(), message.instantaneous.sourceFrameId);
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
    });
    const sink = new BoundedWorkerSink(worker, (diagnostic) =>
      diagnostics.record("processed", performance.now(), diagnostic.frameId),
    );
    const source = new CanvasFrameSource();
    source.start(
      video,
      {
        targetFps: processingHz,
        roi: {
          x: 0,
          y: 0,
          width: settings.width ?? video.videoWidth ?? 640,
          height: settings.height ?? video.videoHeight ?? 360,
        },
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
    if (calibrationRef.current) post({ type: "configure", calibration: calibrationRef.current });
  }

  function stop(): void {
    teardown(pipelineRef.current);
    pipelineRef.current = null;
    diagnostics.reset();
    pinnedRef.current = false;
    setStableReading(null);
    setWobbleReading(null);
  }

  function configure(calibration: CalibrationResult | null): void {
    calibrationRef.current = calibration;
    if (!calibration) {
      pinnedRef.current = false;
      setStableReading(null);
      setWobbleReading(null);
    }
    post({ type: "configure", calibration });
  }

  /** Shows a fixed reading (demo sessions) that live worker output will not replace until reset. */
  function injectReading(reading: StableDimensionReading): void {
    pinnedRef.current = true;
    setStableReading(reading);
    latest.current.onReading?.(reading);
  }

  function post(message: MeasurementWorkerRequest): void {
    pipelineRef.current?.worker.postMessage(message);
  }

  return { sample, stableReading, wobbleReading, processingHz, start, stop, configure, injectReading };
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
