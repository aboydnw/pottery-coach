import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CameraController } from "./CameraController";

class FakeTrack extends EventTarget {
  stop = vi.fn();
  getSettings = vi.fn(() => ({
    deviceId: "rear-camera",
    facingMode: "environment",
    width: 1920,
    height: 1080,
    frameRate: 29.97,
  }));
}

describe("CameraController", () => {
  let track: FakeTrack;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    track = new FakeTrack();
    getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the rear camera with the documented defaults", async () => {
    const controller = new CameraController();

    await controller.start();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  });

  it("returns delivered track settings rather than requested constraints", async () => {
    const controller = new CameraController();

    const result = await controller.start();

    expect(result.settings).toEqual({
      deviceId: "rear-camera",
      facingMode: "environment",
      width: 1920,
      height: 1080,
      frameRate: 29.97,
    });
  });

  it("stops every track owned by the active stream", async () => {
    const secondTrack = new FakeTrack();
    getUserMedia.mockResolvedValue({
      getTracks: () => [track, secondTrack],
      getVideoTracks: () => [track],
    });
    const controller = new CameraController();
    await controller.start();

    controller.stop();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(secondTrack.stop).toHaveBeenCalledOnce();
  });

  it("marks the session interrupted when the document becomes hidden", async () => {
    const controller = new CameraController();
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.start();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "interrupted", reason: "document-hidden" }),
    );
  });
});
