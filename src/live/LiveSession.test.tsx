import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SetupStore } from "../setup/SetupStore";
import type { ToolDependencies } from "../voice/tools/types";
import { LiveSession, type LiveSessionProps } from "./LiveSession";

const { captureFrame, cameraState } = vi.hoisted(() => ({
  captureFrame: vi.fn(() => ({ width: 10, height: 10, data: new Uint8ClampedArray(400) }) as ImageData),
  cameraState: { interrupted: false },
}));

vi.mock("../camera/captureFrame", () => ({ captureFrame }));

vi.mock("../calibration/wheelHead", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../calibration/wheelHead")>()),
  toGray: (data: Uint8ClampedArray, width: number, height: number) => ({ data, width, height, scale: 1 }),
  detectWheelHead: () => ({
    candidates: [{ leftX: 1, rightX: 8, row: 5, confidence: 0.9 }],
  }),
  wheelEllipseCalibration: vi.fn(),
}));

vi.mock("../camera/useCamera", () => ({
  useCamera: () => ({
    facing: "environment",
    settings: null,
    error: null,
    active: true,
    starting: false,
    interrupted: cameraState.interrupted,
    start: vi.fn(async () => ({ width: 10, height: 10, facingMode: "environment" })),
    switchFacing: vi.fn(async () => null),
  }),
}));

vi.mock("../vision/useMeasurementPipeline", () => ({
  useMeasurementPipeline: () => ({
    stableReading: null,
    wobbleReading: null,
    vesselVisible: false,
    handsLikely: false,
    sample: null,
    start: vi.fn(),
    resetBackground: vi.fn(),
    setScale: vi.fn(),
    injectReading: vi.fn(),
  }),
}));

vi.mock("./useLiveCues", () => ({ useLiveCues: vi.fn() }));
vi.mock("../pieces/HistoryPanel", () => ({ HistoryPanel: () => null }));
vi.mock("../pieces/NotesPanel", () => ({ NotesPanel: () => null }));
vi.mock("../diagnostics/DiagnosticsPanel", () => ({ DiagnosticsPanel: () => null }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  captureFrame.mockClear();
  cameraState.interrupted = false;
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

function props(): LiveSessionProps {
  return {
    setup: new SetupStore(memoryStorage()),
    toolBridge: { current: {} as Partial<ToolDependencies> },
    voice: {
      available: false,
      state: "off",
      failure: "disabled",
      captions: [],
      restart: vi.fn(async () => undefined),
      isBusy: () => false,
      speakCue: () => false,
    },
    throwLog: {} as LiveSessionProps["throwLog"],
    pieceId: null,
    pieceNumber: 1,
    lastingNotes: [],
    onForgetNote: vi.fn(),
    onNextPiece: vi.fn(async () => undefined),
    onCorrection: vi.fn(),
    onCue: vi.fn(),
    sizesEnabled: true,
    measurementsUnverified: false,
    demoMode: false,
    cameraOnly: false,
    onCameraReady: vi.fn(),
    onCameraDenied: vi.fn(),
    onReading: vi.fn(),
    onWobble: vi.fn(),
    onMilestone: vi.fn(),
    onProcessingModeChange: vi.fn(),
    onScale: vi.fn(),
    onGoal: vi.fn(),
    onMarkMoment: vi.fn(async () => ({ id: "moment", timestampMs: 0 })),
    onEnd: vi.fn(async () => undefined),
  };
}

function deliverCameraFrame(): void {
  const video = screen.getByLabelText(/camera preview/i);
  Object.defineProperties(video, {
    videoWidth: { value: 10, configurable: true },
    videoHeight: { value: 10, configurable: true },
  });
}

it("keeps the camera visible until the potter explicitly opens touch settings", () => {
  render(<LiveSession {...props()} />);
  deliverCameraFrame();

  expect(screen.queryByRole("region", { name: "Session settings" })).toBeNull();
  expect(screen.getByRole("button", { name: "Settings" }).getAttribute("aria-expanded")).toBe("false");
});

it("keeps touch settings reachable when voice needs reconnecting", () => {
  const reconnecting = props();
  reconnecting.voice.available = true;
  reconnecting.voice.failure = "unavailable";
  render(<LiveSession {...reconnecting} />);

  expect(screen.queryByRole("button", { name: /tap anywhere/i })).toBeNull();
  expect(screen.getByRole("button", { name: /reconnect voice/i })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("region", { name: "Session settings" })).not.toBeNull();
});

it("captures the current camera view when touch starts a wheel-head check", async () => {
  vi.useFakeTimers();
  render(<LiveSession {...props()} />);
  deliverCameraFrame();
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(1_000);
  });
  captureFrame.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "14 in" }));
  fireEvent.click(screen.getByRole("button", { name: /find 14 in wheel head/i }));

  expect(captureFrame).toHaveBeenCalledOnce();
  expect(screen.getByRole("region", { name: /live wheel-head calibration/i })).not.toBeNull();
  expect(document.querySelector("canvas")).toBeNull();

  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(captureFrame).toHaveBeenCalledTimes(2);
});

it("uses the same current-frame loop when voice starts the wheel-head check", async () => {
  vi.useFakeTimers();
  const session = props();
  session.setup.apply({ wheelHeadDiameter: { value: 355.6, unit: "mm" } });
  render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());

  await act(async () => session.toolBridge.current.wheel!.check());
  expect(captureFrame).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(captureFrame).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("region", { name: /live wheel-head calibration/i })).not.toBeNull();
});

it("hides live captions by default and offers an explicit Settings toggle", () => {
  const session = props();
  session.voice.available = true;
  session.voice.state = "connected";
  session.voice.failure = null;
  session.voice.captions = [{ id: "caption-1", speaker: "assistant", text: "Center the wheel", final: true }];
  render(<LiveSession {...session} />);

  expect(screen.queryByText("Center the wheel")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /show captions/i }));
  expect(screen.getByText("Center the wheel")).not.toBeNull();
});

it("discards the live outline and sampling state when the camera is interrupted", async () => {
  vi.useFakeTimers();
  const session = props();
  session.setup.apply({ wheelHeadDiameter: { value: 355.6, unit: "mm" } });
  const view = render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  await act(async () => session.toolBridge.current.wheel!.check());
  expect(screen.getByRole("region", { name: /live wheel-head calibration/i })).not.toBeNull();

  cameraState.interrupted = true;
  view.rerender(<LiveSession {...session} />);
  await act(async () => Promise.resolve());
  expect(screen.queryByRole("region", { name: /live wheel-head calibration/i })).toBeNull();
  const captures = captureFrame.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(captureFrame).toHaveBeenCalledTimes(captures);
});
