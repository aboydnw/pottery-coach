import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasFrameSource } from "./CanvasFrameSource";
import type { AcquiredFrame } from "./FrameSource";

describe("CanvasFrameSource", () => {
  const bitmaps: Array<{ close: ReturnType<typeof vi.fn> }> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    bitmaps.length = 0;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        const bitmap = { close: vi.fn() };
        bitmaps.push(bitmap);
        return bitmap;
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("limits a faster video source to at most ten frames per second", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "accepted" as const);

    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 640, height: 360 } }, sink);
    await vi.advanceTimersByTimeAsync(1000);

    expect(sink.mock.calls.length).toBeLessThanOrEqual(10);
    expect(sink.mock.calls.length).toBeGreaterThanOrEqual(9);
  });

  it("closes a frame immediately when the sink is busy", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "busy" as const);

    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 10, height: 10 } }, sink);
    await vi.advanceTimersByTimeAsync(110);

    expect(bitmaps[0]?.close).toHaveBeenCalledOnce();
  });

  it("cancels scheduled acquisition when stopped", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "accepted" as const);
    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 10, height: 10 } }, sink);

    source.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(sink).not.toHaveBeenCalled();
  });

  it("downscales frames to the processing width and reports the scale", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn((_frame: AcquiredFrame) => "accepted" as const);

    source.start(
      {} as HTMLVideoElement,
      { targetFps: 10, roi: { x: 0, y: 0, width: 1280, height: 720 }, maxOutputWidth: 320 },
      sink,
    );
    await vi.advanceTimersByTimeAsync(110);

    expect((createImageBitmap as ReturnType<typeof vi.fn>).mock.calls[0]?.[5]).toMatchObject({
      resizeWidth: 320,
      resizeHeight: 180,
    });
    expect(sink.mock.calls[0]![0]).toMatchObject({ scale: 4, sourceRoi: { width: 1280, height: 720 } });
  });

  it("adapts the processing rate without changing frame dimensions", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "accepted" as const);
    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 640, height: 360 } }, sink);
    source.updateOptions({ targetFps: 5 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(sink.mock.calls.length).toBeLessThanOrEqual(5);
    const sizes = (createImageBitmap as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[5]);
    expect(new Set(sizes.map((size) => JSON.stringify(size))).size).toBe(1);
  });

  it("keeps sampling after a frame cannot be captured", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "accepted" as const);
    (createImageBitmap as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException("not ready", "InvalidStateError"),
    );

    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 10, height: 10 } }, sink);
    await vi.advanceTimersByTimeAsync(500);

    expect(sink.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("does not run two capture loops after a quick restart", async () => {
    const source = new CanvasFrameSource();
    const sink = vi.fn(() => "accepted" as const);
    const video = {} as HTMLVideoElement;
    source.start(video, { targetFps: 10, roi: { x: 0, y: 0, width: 10, height: 10 } }, sink);
    source.start(video, { targetFps: 10, roi: { x: 0, y: 0, width: 10, height: 10 } }, sink);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sink.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
