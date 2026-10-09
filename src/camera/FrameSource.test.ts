import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasFrameSource } from "./CanvasFrameSource";

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

  it("adapts processing rate while preserving the 640×360 ROI floor", async () => {
    const source = new CanvasFrameSource(); const sink = vi.fn(() => "accepted" as const);
    source.start({} as HTMLVideoElement, { targetFps: 10, roi: { x: 0, y: 0, width: 640, height: 360 } }, sink);
    source.updateOptions({ targetFps: 5, roi: { x: 0, y: 0, width: 320, height: 180 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(sink.mock.calls.length).toBeLessThanOrEqual(5);
    expect((createImageBitmap as ReturnType<typeof vi.fn>).mock.calls[0]?.slice(3)).toEqual([640, 360]);
  });
});
