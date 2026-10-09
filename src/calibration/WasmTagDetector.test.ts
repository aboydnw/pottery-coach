import { expect, it, vi } from "vitest";

import { WasmTagDetector } from "./WasmTagDetector";

class FakeWorker extends EventTarget {
  postMessage = vi.fn((message: { requestId: number }) => {
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: {
      requestId: message.requestId,
      detections: [{
        id: 2,
        corners: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 }, { x: 1, y: 4 }],
        decisionMargin: 52,
      }],
    } })));
  });
  terminate = vi.fn();
}

it("maps a worker detection response to the TagDetector contract", async () => {
  const worker = new FakeWorker();
  const detector = new WasmTagDetector(() => worker as unknown as Worker);
  const frame = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16),
  } as ImageData;

  await expect(detector.detect(frame)).resolves.toEqual([{ id: 2, corners: [
    { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 }, { x: 1, y: 4 },
  ], decisionMargin: 52 }]);
  expect(worker.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 2, height: 2 }),
  );
});

it("terminates the isolated detector worker when disposed", () => {
  const worker = new FakeWorker();
  const detector = new WasmTagDetector(() => worker as unknown as Worker);

  detector.dispose();

  expect(worker.terminate).toHaveBeenCalledOnce();
});
