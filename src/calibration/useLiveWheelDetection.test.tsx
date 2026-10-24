import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { WheelHeadCandidates } from "./wheelHead";
import { useLiveWheelDetection } from "./useLiveWheelDetection";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const image = (marker: number) =>
  ({
    width: 640,
    height: 480,
    data: Object.assign(new Uint8ClampedArray(640 * 480 * 4), { 0: marker }),
  }) as unknown as ImageData;

const found = (centerX: number): WheelHeadCandidates => ({
  leftX: centerX - 75,
  rightX: centerX + 75,
  row: 180,
  confidence: 0.95,
  candidates: [
    {
      leftX: centerX - 75,
      rightX: centerX + 75,
      row: 180,
      confidence: 0.95,
      ellipse: {
        centerX,
        centerY: 180,
        radiusMajor: 75,
        radiusMinor: 37.5,
        rotationRad: 0,
        fitResidualPx95: 0.25,
        visibleArcFraction: 1,
        confidence: 0.95,
      },
    },
  ],
});

function videoRef() {
  return { current: { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement };
}

it("captures successive current frames and discards prior geometry on a new request", async () => {
  vi.useFakeTimers();
  const capture = vi.fn().mockReturnValueOnce(image(1)).mockReturnValueOnce(image(2)).mockReturnValue(image(3));
  const detect = vi.fn().mockReturnValueOnce(found(125)).mockReturnValueOnce(found(195)).mockReturnValue(found(160));
  const { result } = renderHook(() =>
    useLiveWheelDetection({ videoRef: videoRef(), diameterMm: 355.6, onStable: vi.fn(), capture, detect }),
  );

  await act(async () => result.current.start());
  expect(result.current.ellipse?.centerX).toBe(251);
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(capture).toHaveBeenCalledTimes(2);
  expect(result.current.ellipse?.centerX).toBe(391);

  act(() => result.current.stop());
  await act(async () => vi.advanceTimersByTimeAsync(1_000));
  expect(capture).toHaveBeenCalledTimes(2);

  await act(async () => result.current.start());
  expect(result.current.ellipse?.centerX).toBe(321);
});

it("accepts only supported geometry that remains stable for about one second", async () => {
  vi.useFakeTimers();
  const onStable = vi.fn();
  const capture = vi.fn(() => image(1));
  const detect = vi.fn(() => found(160));
  const { result } = renderHook(() =>
    useLiveWheelDetection({ videoRef: videoRef(), diameterMm: 355.6, onStable, capture, detect }),
  );

  await act(async () => result.current.start());
  await act(async () => vi.advanceTimersByTimeAsync(799));
  expect(onStable).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(201));
  expect(onStable).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe("found");
});

it("suspends detector replacement while the potter adjusts the live outline", async () => {
  vi.useFakeTimers();
  const detect = vi.fn().mockReturnValueOnce(found(125)).mockReturnValue(found(195));
  const { result } = renderHook(() =>
    useLiveWheelDetection({
      videoRef: videoRef(),
      diameterMm: 355.6,
      onStable: vi.fn(),
      capture: vi.fn(() => image(1)),
      detect,
    }),
  );

  await act(async () => result.current.start());
  act(() => result.current.adjustEllipse({ ...result.current.ellipse!, centerX: 280 }));
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(result.current.ellipse?.centerX).toBe(280);
  expect(result.current.adjusted).toBe(true);
});

it("does not accept gradual drift that leaves the original stability envelope", async () => {
  vi.useFakeTimers();
  const onStable = vi.fn();
  let center = 150;
  const { result } = renderHook(() =>
    useLiveWheelDetection({
      videoRef: videoRef(),
      diameterMm: 355.6,
      onStable,
      capture: vi.fn(() => image(1)),
      detect: vi.fn(() => {
        const current = center;
        center += 5;
        return found(current);
      }),
    }),
  );

  await act(async () => result.current.start());
  await act(async () => vi.advanceTimersByTimeAsync(1_400));
  expect(onStable).not.toHaveBeenCalled();
  expect(result.current.status).toBe("steady");
});

it("pauses and clears stale geometry after a detection failure until retry", async () => {
  vi.useFakeTimers();
  const capture = vi
    .fn()
    .mockReturnValueOnce(image(1))
    .mockImplementationOnce(() => {
      throw new Error("camera read failed");
    })
    .mockReturnValue(image(2));
  const { result } = renderHook(() =>
    useLiveWheelDetection({
      videoRef: videoRef(),
      diameterMm: 355.6,
      onStable: vi.fn(),
      capture,
      detect: vi.fn(() => found(160)),
    }),
  );

  await act(async () => result.current.start());
  expect(result.current.ellipse).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(result.current.status).toBe("error");
  expect(result.current.ellipse).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(capture).toHaveBeenCalledTimes(2);
  await act(async () => result.current.retry());
  expect(capture).toHaveBeenCalledTimes(3);
  expect(result.current.ellipse).not.toBeNull();
});

it("waits for video dimensions without reporting an error, then samples the current frame", async () => {
  vi.useFakeTimers();
  const ref = videoRef();
  Object.defineProperties(ref.current, {
    videoWidth: { value: 0, configurable: true },
    videoHeight: { value: 0, configurable: true },
  });
  const capture = vi.fn(() => image(1));
  const { result, unmount } = renderHook(() =>
    useLiveWheelDetection({
      videoRef: ref,
      diameterMm: 355.6,
      onStable: vi.fn(),
      capture,
      detect: vi.fn(() => found(160)),
    }),
  );

  await act(async () => result.current.start());
  expect(result.current.status).toBe("finding");
  expect(result.current.error).toBeNull();
  expect(capture).not.toHaveBeenCalled();
  Object.defineProperties(ref.current, { videoWidth: { value: 640 }, videoHeight: { value: 480 } });
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(capture).toHaveBeenCalledOnce();
  unmount();
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(capture).toHaveBeenCalledOnce();
});
