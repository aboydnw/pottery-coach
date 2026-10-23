import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SetupStore } from "../setup/SetupStore";
import type { ToolDependencies } from "../voice/tools/types";
import { LiveSession, type LiveSessionProps } from "./LiveSession";

const { captureFrame } = vi.hoisted(() => ({
  captureFrame: vi.fn(() => ({ width: 10, height: 10, data: new Uint8ClampedArray(400) }) as ImageData),
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
    interrupted: false,
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

it("keeps the camera visible until the potter explicitly opens touch settings", () => {
  render(<LiveSession {...props()} />);

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
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(1_000);
  });
  captureFrame.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "14 in" }));
  fireEvent.click(screen.getByRole("button", { name: /find 14 in wheel head/i }));

  expect(captureFrame).toHaveBeenCalledOnce();
});
