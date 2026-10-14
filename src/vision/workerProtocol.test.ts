import { describe, expect, it, vi } from "vitest";

import { BoundedWorkerSink } from "./workerProtocol";

const roi = { x: 0, y: 0, width: 4, height: 4 };

describe("BoundedWorkerSink", () => {
  it("allows only one pending frame and leaves rejected-frame disposal to the producer", () => {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    const sink = new BoundedWorkerSink(worker);
    const first = { close: vi.fn() } as unknown as ImageBitmap;
    const second = { close: vi.fn() } as unknown as ImageBitmap;

    expect(sink.submit({ frameId: 1, capturedAtMs: 10, bitmap: first, sourceRoi: roi, scale: 1 })).toBe("accepted");
    expect(sink.submit({ frameId: 2, capturedAtMs: 20, bitmap: second, sourceRoi: roi, scale: 1 })).toBe("busy");
    expect(second.close).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledOnce();
  });

  it("releases the pending slot when the worker responds", () => {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    const sink = new BoundedWorkerSink(worker);
    const first = { close: vi.fn() } as unknown as ImageBitmap;
    const second = { close: vi.fn() } as unknown as ImageBitmap;
    sink.submit({ frameId: 1, capturedAtMs: 10, bitmap: first, sourceRoi: roi, scale: 1 });

    worker.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "diagnostic", frameId: 1, processingMs: 2, droppedBefore: 0 },
      }),
    );

    expect(sink.submit({ frameId: 2, capturedAtMs: 20, bitmap: second, sourceRoi: roi, scale: 1 })).toBe("accepted");
  });

  it("releases the pending slot when the worker crashes and counts refused frames", () => {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    const sink = new BoundedWorkerSink(worker);
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    sink.submit({ frameId: 1, capturedAtMs: 10, bitmap, sourceRoi: roi, scale: 1 });
    sink.submit({ frameId: 2, capturedAtMs: 20, bitmap, sourceRoi: roi, scale: 1 });
    worker.dispatchEvent(new Event("error"));
    expect(sink.submit({ frameId: 3, capturedAtMs: 30, bitmap, sourceRoi: roi, scale: 1 })).toBe("accepted");
    expect(sink.droppedFrames).toBe(1);
  });
});
