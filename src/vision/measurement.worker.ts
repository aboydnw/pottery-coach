/// <reference lib="webworker" />

import type { DiagnosticResponse, FrameRequest } from "./workerProtocol";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<FrameRequest>) => {
  if (event.data?.type !== "frame") return;
  const startedAt = performance.now();
  event.data.bitmap.close();
  const response: DiagnosticResponse = {
    type: "diagnostic",
    frameId: event.data.frameId,
    processingMs: performance.now() - startedAt,
    droppedBefore: event.data.droppedBefore,
  };
  worker.postMessage(response);
});
