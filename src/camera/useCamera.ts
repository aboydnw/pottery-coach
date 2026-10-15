import { useEffect, useRef, useState, type RefObject } from "react";
import { CameraController, cameraConstraints, type CameraFacing } from "./CameraController";
import type { CameraSettings } from "./types";
import { useLatest } from "../shared/useLatest";

type WakeLockSentinelLike = { release(): Promise<void> };

export type CameraCallbacks = {
  onDenied?(): void;
};

/**
 * Owns the rear-camera stream, its permission errors, interruption state, and screen wake lock.
 * The stream is attached to the video element behind `videoRef`.
 */
export function useCamera(videoRef: RefObject<HTMLVideoElement | null>, callbacks: CameraCallbacks = {}) {
  const [controller] = useState(() => new CameraController());
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const latest = useLatest(callbacks);
  const [settings, setSettings] = useState<CameraSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "active">("idle");
  const [interrupted, setInterrupted] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>("user");

  useEffect(() => {
    const unsubscribe = controller.subscribe((event) => {
      if (event.type === "interrupted" || event.type === "muted" || event.type === "ended") setInterrupted(true);
    });
    return () => {
      unsubscribe();
      controller.dispose();
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [controller]);

  async function start(requested: CameraFacing = facing): Promise<CameraSettings | null> {
    setError(null);
    setStatus("starting");
    try {
      const result = await controller.start(cameraConstraints(requested));
      setFacing(requested);
      if (videoRef.current) videoRef.current.srcObject = result.stream;
      setSettings(result.settings);
      setStatus("active");
      setInterrupted(false);
      wakeLockRef.current ??= await requestWakeLock();
      return result.settings;
    } catch (startError) {
      if (startError instanceof DOMException && startError.name === "AbortError") return null;
      setError(cameraErrorMessage(startError));
      setStatus("idle");
      latest.current.onDenied?.();
      return null;
    }
  }

  function stop(): void {
    controller.stop();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setSettings(null);
    setInterrupted(false);
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }

  /** Restarts the stream on the other camera; resolves with the new settings, or null if it failed. */
  function switchFacing(): Promise<CameraSettings | null> {
    return start(facing === "user" ? "environment" : "user");
  }

  return {
    facing,
    switchFacing,
    settings,
    error,
    active: status === "active",
    starting: status === "starting",
    interrupted,
    start,
    stop,
  };
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Camera access was denied. Allow camera access in browser settings and retry.";
    if (error.name === "NotFoundError") return "No camera was found on this device.";
    if (error.name === "NotReadableError") return "The camera is already in use by another app.";
  }
  return "The camera could not be started. Check the connection and retry.";
}

async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } })
    .wakeLock;
  if (!wakeLock) return null;
  try {
    return await wakeLock.request("screen");
  } catch {
    return null;
  }
}
