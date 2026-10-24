import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { captureFrame } from "../camera/captureFrame";
import { detectWheelHead, toGray, type WheelHeadCandidates, type WheelHeadDetection } from "./wheelHead";
import type { WheelEllipse } from "./wheelEllipse";
import { deriveWheelViewPose } from "./wheelViewPose";

const SAMPLE_MS = 200;
const STABLE_MS = 900;

export type LiveWheelStatus = "idle" | "finding" | "steady" | "found" | "error";

type Options = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  diameterMm: number;
  onStable(ellipse: WheelEllipse): void;
  capture?: typeof captureFrame;
  detect?: typeof detectWheelHead;
};

type FrameSize = { width: number; height: number };

export type LiveWheelDetection = {
  active: boolean;
  status: LiveWheelStatus;
  frameSize: FrameSize | null;
  candidates: WheelHeadDetection[];
  candidateIndex: number;
  ellipse: WheelEllipse | null;
  adjusted: boolean;
  error: string | null;
  start(diameterMm?: number): Promise<{ found: boolean; confidence: number }>;
  stop(): void;
  retry(): Promise<{ found: boolean; confidence: number }>;
  switchCandidate(toward: "inner" | "outer"): boolean;
  adjustEllipse(ellipse: WheelEllipse): void;
};

export function useLiveWheelDetection(options: Options): LiveWheelDetection {
  const { videoRef, diameterMm } = options;
  const capture = options.capture ?? captureFrame;
  const detect = options.detect ?? detectWheelHead;
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<LiveWheelStatus>("idle");
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);
  const [candidates, setCandidates] = useState<WheelHeadDetection[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [ellipse, setEllipse] = useState<WheelEllipse | null>(null);
  const [adjusted, setAdjusted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const activeRef = useRef(false);
  const adjustedRef = useRef(false);
  const candidateIndexRef = useRef(0);
  const candidatesRef = useRef<WheelHeadDetection[]>([]);
  const ellipseRef = useRef<WheelEllipse | null>(null);
  const stableAnchorRef = useRef<WheelEllipse | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const acceptedRef = useRef(false);
  const pausedRef = useRef(false);
  const diameterRef = useRef(diameterMm);
  const onStableRef = useRef(options.onStable);

  useEffect(() => {
    onStableRef.current = options.onStable;
  }, [options.onStable]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    setActive(false);
    setStatus("idle");
    setCandidates([]);
    candidatesRef.current = [];
    setEllipse(null);
    ellipseRef.current = null;
    stableSinceRef.current = null;
    stableAnchorRef.current = null;
    acceptedRef.current = false;
    pausedRef.current = false;
    adjustedRef.current = false;
    setAdjusted(false);
    setError(null);
  }, [clearTimer]);

  const sample = useCallback(async (): Promise<{ found: boolean; confidence: number }> => {
    if (!activeRef.current || runningRef.current || adjustedRef.current)
      return { found: Boolean(ellipseRef.current), confidence: ellipseRef.current?.confidence ?? 0 };
    const video = videoRef.current;
    if (!video) return { found: false, confidence: 0 };
    if (!video.videoWidth || !video.videoHeight) {
      setStatus("finding");
      setError(null);
      return { found: false, confidence: 0 };
    }
    runningRef.current = true;
    try {
      const image = capture(video);
      const gray = toGray(image.data, image.width, image.height);
      const detected = detect(gray) as WheelHeadCandidates;
      const toFull = (value: number) => (value + 0.5) * gray.scale;
      const mapped = detected.candidates.map((candidate) => mapCandidate(candidate, toFull, gray.scale));
      candidatesRef.current = mapped;
      const index = Math.min(candidateIndexRef.current, Math.max(0, mapped.length - 1));
      candidateIndexRef.current = index;
      const selected = mapped[index];
      setFrameSize({ width: image.width, height: image.height });
      setCandidates(mapped);
      setCandidateIndex(index);
      if (!selected) {
        stableSinceRef.current = null;
        stableAnchorRef.current = null;
        setStatus("finding");
        setEllipse(null);
        ellipseRef.current = null;
        return { found: false, confidence: 0 };
      }
      const next = selected.ellipse ?? fallbackEllipse(selected);
      const previous = ellipseRef.current;
      setEllipse(next);
      ellipseRef.current = next;
      const supported =
        next.confidence >= 0.8 &&
        deriveWheelViewPose(next, diameterRef.current, { width: image.width, height: image.height }).reasons.length ===
          0;
      if (!supported) {
        stableSinceRef.current = null;
        stableAnchorRef.current = null;
        setStatus("finding");
      } else if (
        !previous ||
        !stableAnchorRef.current ||
        !similar(stableAnchorRef.current, next, image.width, image.height)
      ) {
        stableAnchorRef.current = next;
        stableSinceRef.current = Date.now();
        setStatus("steady");
      } else {
        stableSinceRef.current ??= Date.now();
        setStatus("steady");
        if (!acceptedRef.current && Date.now() - stableSinceRef.current >= STABLE_MS) {
          acceptedRef.current = true;
          clearTimer();
          setStatus("found");
          onStableRef.current(next);
        }
      }
      setError(null);
      return { found: selected.confidence >= 0.5, confidence: Math.round(selected.confidence * 100) / 100 };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Wheel detection failed.";
      pausedRef.current = true;
      clearTimer();
      candidatesRef.current = [];
      ellipseRef.current = null;
      stableAnchorRef.current = null;
      stableSinceRef.current = null;
      setCandidates([]);
      setEllipse(null);
      setError(message);
      setStatus("error");
      return { found: false, confidence: 0 };
    } finally {
      runningRef.current = false;
    }
  }, [capture, clearTimer, detect, videoRef]);

  const start = useCallback(
    async (diameterOverride?: number) => {
      clearTimer();
      activeRef.current = true;
      adjustedRef.current = false;
      candidateIndexRef.current = 0;
      ellipseRef.current = null;
      stableSinceRef.current = null;
      stableAnchorRef.current = null;
      acceptedRef.current = false;
      pausedRef.current = false;
      diameterRef.current = diameterOverride ?? diameterMm;
      setActive(true);
      setStatus("finding");
      setFrameSize(null);
      setCandidates([]);
      candidatesRef.current = [];
      setCandidateIndex(0);
      setEllipse(null);
      setAdjusted(false);
      setError(null);
      const result = await sample();
      if (activeRef.current && !acceptedRef.current && !pausedRef.current)
        intervalRef.current = window.setInterval(() => void sample(), SAMPLE_MS);
      return result;
    },
    [clearTimer, diameterMm, sample],
  );

  const switchCandidate = useCallback((toward: "inner" | "outer") => {
    const index = candidateIndexRef.current + (toward === "inner" ? 1 : -1);
    const selected = candidatesRef.current[index];
    if (!selected) return false;
    candidateIndexRef.current = index;
    setCandidateIndex(index);
    const next = selected.ellipse ?? fallbackEllipse(selected);
    ellipseRef.current = next;
    setEllipse(next);
    stableSinceRef.current = null;
    stableAnchorRef.current = null;
    return true;
  }, []);

  const adjustEllipse = useCallback((next: WheelEllipse) => {
    adjustedRef.current = true;
    setAdjusted(true);
    stableSinceRef.current = null;
    stableAnchorRef.current = null;
    ellipseRef.current = next;
    setEllipse(next);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    active,
    status,
    frameSize,
    candidates,
    candidateIndex,
    ellipse,
    adjusted,
    error,
    start,
    stop,
    retry: () => start(diameterRef.current),
    switchCandidate,
    adjustEllipse,
  };
}

function mapCandidate(
  candidate: WheelHeadDetection,
  toFull: (value: number) => number,
  scale: number,
): WheelHeadDetection {
  return {
    ...candidate,
    leftX: toFull(candidate.leftX),
    rightX: toFull(candidate.rightX),
    row: toFull(candidate.row),
    ellipse: candidate.ellipse
      ? {
          ...candidate.ellipse,
          centerX: toFull(candidate.ellipse.centerX),
          centerY: toFull(candidate.ellipse.centerY),
          radiusMajor: candidate.ellipse.radiusMajor * scale,
          radiusMinor: candidate.ellipse.radiusMinor * scale,
          fitResidualPx95: candidate.ellipse.fitResidualPx95 * scale,
        }
      : undefined,
  };
}

function fallbackEllipse(detection: WheelHeadDetection): WheelEllipse {
  const radiusMajor = Math.max(1, (detection.rightX - detection.leftX) / 2);
  return {
    centerX: (detection.leftX + detection.rightX) / 2,
    centerY: detection.row,
    radiusMajor,
    radiusMinor: radiusMajor * 0.4,
    rotationRad: 0,
    fitResidualPx95: radiusMajor,
    visibleArcFraction: 0,
    confidence: 0,
  };
}

function similar(a: WheelEllipse, b: WheelEllipse, width: number, height: number): boolean {
  return (
    Math.abs(a.centerX - b.centerX) <= width * 0.02 &&
    Math.abs(a.centerY - b.centerY) <= height * 0.02 &&
    Math.abs(a.radiusMajor - b.radiusMajor) <= width * 0.025 &&
    Math.abs(a.radiusMinor - b.radiusMinor) <= height * 0.025 &&
    Math.abs(a.rotationRad - b.rotationRad) <= 0.05
  );
}
