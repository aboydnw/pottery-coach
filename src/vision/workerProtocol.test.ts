import { describe, expect, it, vi } from "vitest";

import { BoundedWorkerSink } from "./workerProtocol";

describe("BoundedWorkerSink", () => {
  it("allows only one pending frame and leaves rejected-frame disposal to the producer", () => {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    const sink = new BoundedWorkerSink(worker);
    const first = { close: vi.fn() } as unknown as ImageBitmap;
    const second = { close: vi.fn() } as unknown as ImageBitmap;

    expect(sink.submit({ frameId: 1, capturedAtMs: 10, bitmap: first })).toBe("accepted");
    expect(sink.submit({ frameId: 2, capturedAtMs: 20, bitmap: second })).toBe("busy");
    expect(second.close).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledOnce();
  });

  it("releases the pending slot when the worker responds", () => {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    const sink = new BoundedWorkerSink(worker);
    const first = { close: vi.fn() } as unknown as ImageBitmap;
    const second = { close: vi.fn() } as unknown as ImageBitmap;
    sink.submit({ frameId: 1, capturedAtMs: 10, bitmap: first });

    worker.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "diagnostic", frameId: 1, processingMs: 2, droppedBefore: 0 },
      }),
    );

    expect(sink.submit({ frameId: 2, capturedAtMs: 20, bitmap: second })).toBe("accepted");
  });
});
