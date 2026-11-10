import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SetupStore } from "../setup/SetupStore";
import { demoCalibration } from "../app/demoFixtures";
import { wheelViewPoseFromBoardCalibration } from "../calibration/boardCalibration";
import type { ToolDependencies } from "../voice/tools/types";
import { LiveSession, type LiveSessionProps } from "./LiveSession";

const { captureFrame, cameraState, wheelEllipseCalibration, calibrateFromVideo, pipelineStart, pipelineStop } =
  vi.hoisted(() => ({
    captureFrame: vi.fn(() => ({ width: 10, height: 10, data: new Uint8ClampedArray(400) }) as ImageData),
    cameraState: { interrupted: false },
    wheelEllipseCalibration: vi.fn(() => ({ status: "rejected", reasons: [] })),
    calibrateFromVideo: vi.fn(),
    pipelineStart: vi.fn(),
    pipelineStop: vi.fn(),
  }));

vi.mock("../calibration/calibrateFromVideo", () => ({ calibrateFromVideo }));
vi.mock("../calibration/WasmTagDetector", () => ({
  WasmTagDetector: class {
    dispose() {}
  },
}));

vi.mock("../camera/captureFrame", () => ({ captureFrame }));

vi.mock("../calibration/wheelHead", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../calibration/wheelHead")>()),
  toGray: (data: Uint8ClampedArray, width: number, height: number) => ({ data, width, height, scale: 1 }),
  detectWheelHead: () => ({
    candidates: [{ leftX: 1, rightX: 8, row: 5, confidence: 0.9 }],
  }),
  wheelEllipseCalibration,
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
    start: pipelineStart,
    stop: pipelineStop,
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
  wheelEllipseCalibration.mockClear();
  cameraState.interrupted = false;
  calibrateFromVideo.mockReset();
  pipelineStart.mockClear();
  pipelineStop.mockClear();
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

it("explains an exhausted voice allowance and keeps touch settings reachable", () => {
  const limited = props();
  limited.voice.available = true;
  limited.voice.failure = "limited";
  render(<LiveSession {...limited} />);
  expect(screen.getByText(/voice allowance reached/i)).not.toBeNull();
  expect(screen.queryByRole("button", { name: /reconnect voice/i })).toBeNull();
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
  fireEvent.click(screen.getByRole("button", { name: /optional wheel-head detection/i }));
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

it("confirms the latest voice-adjusted outline without waiting for a React render", async () => {
  const session = props();
  session.setup.apply({ wheelHeadDiameter: { value: 355.6, unit: "mm" } });
  render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  await act(async () => session.toolBridge.current.wheel!.check());

  session.toolBridge.current.wheel!.adjust("left", "out", "small");
  session.toolBridge.current.wheel!.confirm();

  expect(wheelEllipseCalibration).toHaveBeenLastCalledWith(
    expect.objectContaining({ adjustedByUser: true, ellipse: expect.objectContaining({ radiusMajor: 3.75 }) }),
  );
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

async function confirmPrintedPage(session: LiveSessionProps, calibration = demoCalibration()): Promise<void> {
  calibrateFromVideo.mockResolvedValue(calibration);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /printed line measures/i }));
  fireEvent.click(screen.getByRole("button", { name: /detect printed page/i }));
  await act(async () => vi.advanceTimersByTimeAsync(600));
  fireEvent.click(screen.getByRole("checkbox", { name: /100 mm line measures/i }));
  fireEvent.click(screen.getByRole("button", { name: /use calibration/i }));
  expect(session.setup.getSnapshot().calibration).toBe("checking");
}

it("waits for page removal before learning a fresh background and enabling calibrated sizes", async () => {
  vi.useFakeTimers();
  const session = props();
  render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  await confirmPrintedPage(session);
  expect(pipelineStop).toHaveBeenCalledOnce();
  expect(session.onScale).toHaveBeenLastCalledWith(null);
  pipelineStart.mockClear();
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(pipelineStart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /page removed, learn empty wheel/i }));
  expect(pipelineStart).toHaveBeenCalledWith(screen.getByLabelText(/camera preview/i), { freshBackground: true });
  expect(session.setup.getSnapshot().calibration).toBe("confirmed");
  expect(session.onScale).toHaveBeenLastCalledWith(expect.objectContaining({ calibrationId: "demo-calibration" }));
  expect(screen.queryByRole("button", { name: /page removed/i })).toBeNull();
});

it("discards a pending board calibration when the camera is interrupted before page removal", async () => {
  vi.useFakeTimers();
  const session = props();
  const view = render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  await confirmPrintedPage(session);
  cameraState.interrupted = true;
  view.rerender(<LiveSession {...session} />);
  await act(async () => Promise.resolve());
  expect(screen.queryByRole("button", { name: /page removed/i })).toBeNull();
  expect(session.setup.getSnapshot().calibration).toBe("none");
  expect(session.onScale).toHaveBeenLastCalledWith(null);
});

it("keeps camera-only sessions from starting measurement after page removal", async () => {
  vi.useFakeTimers();
  const session = props();
  session.cameraOnly = true;
  render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  await confirmPrintedPage(session);
  fireEvent.click(screen.getByRole("button", { name: /page removed, learn empty wheel/i }));
  expect(pipelineStart).not.toHaveBeenCalled();
});

it("explains shape-only fallback instead of enabling sizes for unsupported board perspective", async () => {
  vi.useFakeTimers();
  const session = props();
  render(<LiveSession {...session} />);
  deliverCameraFrame();
  await act(async () => Promise.resolve());
  const calibration = demoCalibration();
  calibration.wheelViewPose = {
    ...wheelViewPoseFromBoardCalibration(calibration),
    metricUnsupportedReason: "BOARD_PERSPECTIVE_UNSUPPORTED",
  };
  await confirmPrintedPage(session, calibration);
  fireEvent.click(screen.getByRole("button", { name: /page removed, learn empty wheel/i }));
  expect(session.onScale).toHaveBeenLastCalledWith(null);
  expect(session.setup.getSnapshot().calibration).toBe("skipped");
  expect(screen.getByRole("alert", { name: "Calibration guidance" })).not.toBeNull();
});
