export type Capabilities = {
  camera: boolean;
  microphone: boolean;
  offscreenCanvas: boolean;
  trackProcessor: boolean;
  videoFrameCallback: boolean;
  wakeLock: boolean;
  webRtc: boolean;
};

export function detectCapabilities(): Capabilities {
  const mediaCapture =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  return {
    camera: mediaCapture,
    microphone: mediaCapture,
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    trackProcessor:
      typeof (globalThis as { MediaStreamTrackProcessor?: unknown })
        .MediaStreamTrackProcessor === "function",
    videoFrameCallback:
      typeof HTMLVideoElement !== "undefined" &&
      "requestVideoFrameCallback" in HTMLVideoElement.prototype,
    wakeLock: typeof navigator !== "undefined" && "wakeLock" in navigator,
    webRtc: typeof RTCPeerConnection !== "undefined",
  };
}
