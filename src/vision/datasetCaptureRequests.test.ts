import { expect, it, vi } from "vitest";

import type { DatasetFrameCapture } from "./workerProtocol";
import { DatasetCaptureRequests } from "./datasetCaptureRequests";

const capture: DatasetFrameCapture = {
  captureId: "capture-1",
  width: 1,
  height: 1,
  rgba: new Uint8ClampedArray([1, 2, 3, 255]),
  automaticMask: new Uint8Array([1]),
  segmentationVersion: "background-v1",
  calibrationId: "cal-1",
  wheelDiameterMm: 350,
  calibrationGeometry: null,
};

it("resolves only the matching one-shot capture", async () => {
  const requests = new DatasetCaptureRequests(() => "capture-1", 5_000);
  const pending = requests.request();
  expect(requests.resolve({ ...capture, captureId: "other" })).toBe(false);
  expect(requests.resolve(capture)).toBe(true);
  await expect(pending.promise).resolves.toEqual(capture);
});

it("rejects concurrent requests", async () => {
  const requests = new DatasetCaptureRequests(() => "capture-1", 5_000);
  const first = requests.request();
  const rejected = first.promise.catch((error: unknown) => error);
  expect(() => requests.request()).toThrow(/already pending/i);
  requests.rejectPending("stopped");
  const error = await rejected;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toMatch(/stopped/i);
});

it("times out when no processed frame arrives", async () => {
  vi.useFakeTimers();
  const requests = new DatasetCaptureRequests(() => "capture-1", 5_000);
  const pending = requests.request();
  const rejected = pending.promise.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(5_000);
  const error = await rejected;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toMatch(/timed out/i);
  vi.useRealTimers();
});
