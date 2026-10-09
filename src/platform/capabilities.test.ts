import { afterEach, describe, expect, it, vi } from "vitest";

import { detectCapabilities } from "./capabilities";

describe("detectCapabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unavailable browser APIs as unsupported", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal("MediaStreamTrackProcessor", undefined);
    vi.stubGlobal("RTCPeerConnection", undefined);

    expect(detectCapabilities()).toEqual({
      camera: false,
      microphone: false,
      offscreenCanvas: false,
      trackProcessor: false,
      videoFrameCallback: false,
      wakeLock: false,
      webRtc: false,
    });
  });

  it("does not mistake track processing support for camera support", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("MediaStreamTrackProcessor", class MediaStreamTrackProcessor {});

    const capabilities = detectCapabilities();

    expect(capabilities.trackProcessor).toBe(true);
    expect(capabilities.camera).toBe(false);
  });
});
