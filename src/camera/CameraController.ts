import type { CameraEvent, CameraSettings, CameraStartResult } from "./types";

export type CameraFacing = "user" | "environment";

/** Video-only constraints preferring the given camera; `ideal` lets single-camera devices still start. */
export function cameraConstraints(facing: CameraFacing): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  };
}

export class CameraController {
  private stream: MediaStream | null = null;
  private listeners = new Set<(event: CameraEvent) => void>();
  private listeningForVisibility = false;
  private generation = 0;

  async start(constraints: MediaStreamConstraints = cameraConstraints("user")): Promise<CameraStartResult> {
    this.stop();
    const generation = this.generation;
    this.listenForVisibility();

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (generation !== this.generation) {
        stream.getTracks().forEach((item) => item.stop());
        throw new DOMException("A newer camera request replaced this one", "AbortError");
      }
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((item) => item.stop());
        throw new Error("Camera stream did not contain a video track");
      }

      this.stream = stream;
      const settings = this.pickSettings(track.getSettings());
      track.addEventListener("mute", () => this.emit({ type: "muted" }));
      track.addEventListener("unmute", () => this.emit({ type: "unmuted" }));
      track.addEventListener("ended", () => this.emit({ type: "ended", reason: "track-ended" }));
      this.emit({ type: "started", settings });
      this.emit({ type: "settings", settings });
      return { stream, settings };
    } catch (error) {
      this.emit({ type: "error", reason: this.errorReason(error), error });
      throw error;
    }
  }

  /** Stops the active stream and invalidates any start() still waiting for permission. */
  stop(): void {
    this.generation += 1;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  /** Stops the camera and detaches document listeners; the controller should not be reused. */
  dispose(): void {
    this.stop();
    this.listeners.clear();
    if (this.listeningForVisibility) document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.listeningForVisibility = false;
  }

  switchDevice(deviceId: string): Promise<CameraStartResult> {
    return this.start({
      audio: false,
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  }

  subscribe(listener: (event: CameraEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private listenForVisibility(): void {
    if (this.listeningForVisibility) return;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.listeningForVisibility = true;
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden" && this.stream) {
      this.emit({ type: "interrupted", reason: "document-hidden" });
    }
  };

  private pickSettings(settings: MediaTrackSettings): CameraSettings {
    return {
      deviceId: settings.deviceId,
      facingMode: settings.facingMode,
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
    };
  }

  private emit(event: Omit<CameraEvent, "timestamp">): void {
    const stamped = { ...event, timestamp: performance.now() };
    this.listeners.forEach((listener) => listener(stamped));
  }

  private errorReason(error: unknown): string {
    if (!(error instanceof DOMException)) return "unknown";
    if (error.name === "NotAllowedError") return "permission-denied";
    if (error.name === "NotFoundError") return "camera-not-found";
    if (error.name === "NotReadableError") return "camera-in-use";
    if (error.name === "AbortError") return "superseded";
    return "unknown";
  }
}
