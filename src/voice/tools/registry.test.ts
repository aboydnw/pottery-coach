import { expect, it, vi } from "vitest";

import { loadTemplates } from "../../targets/loadTemplates";
import type { SessionScale } from "../../measurement/scale";
import type { StableDimensionReading } from "../../measurement/types";
import { SetupStore } from "../../setup/SetupStore";
import { REALTIME_TOOL_DEFINITIONS } from "./definitions";
import { createToolRegistry } from "./registry";
import type { ToolDependencies } from "./types";

const component = { score: 0.9, reasons: [] };
const scale: SessionScale = {
  mmPerPixel: 0.25,
  method: "wheel-head",
  calibrationId: "c",
  estimatedErrorMm95: 1,
  confirmedAtMs: 0,
};
const target = loadTemplates().find((template) => template.id === "straight-cylinder-v1")!;

function pixelReading(overrides: Partial<StableDimensionReading> = {}): StableDimensionReading {
  return {
    id: "reading-1",
    timestampMs: 900,
    sourceFrameId: 1,
    calibrationId: "c",
    unit: "px",
    height: 480,
    maximumWidth: 240,
    rimWidth: 220,
    baseWidth: 200,
    centerlineOffset: 0,
    visibleAsymmetry: 0,
    profile: Array.from({ length: 64 }, (_, index) => ({ heightRatio: index / 63, radius: 110, confidence: 0.9 })),
    confidence: {
      overall: 0.9,
      calibration: component,
      segmentation: component,
      occlusion: component,
      temporalStability: component,
      freshnessMs: 100,
      estimatedError95: 4,
    },
    windowStartMs: 0,
    contributingFrameCount: 5,
    lastReliableTimestampMs: 900,
    ...overrides,
  };
}

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

function dependencies(overrides: Partial<ToolDependencies> = {}): ToolDependencies {
  return {
    now: () => 1000,
    getReading: () => pixelReading(),
    getScale: () => null,
    getWobble: () => null,
    getTarget: () => target,
    getGoal: () => null,
    setup: new SetupStore(memoryStorage()),
    setPaused: vi.fn(),
    ...overrides,
  };
}

it("implements exactly the tools offered to the provider", () => {
  expect(createToolRegistry(dependencies()).names.sort()).toEqual(
    REALTIME_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
  );
});

it("rejects unknown tools and invalid arguments", async () => {
  const registry = createToolRegistry(dependencies());
  await expect(registry.call("unknown", {})).rejects.toThrow();
  await expect(registry.call("proposeSetup", { wheelHeadDiameter: { value: 14 } })).rejects.toThrow();
});

it("gives proportions, never sizes, before a scale exists", async () => {
  const result = await createToolRegistry(dependencies()).call("getCurrentDimensions", {});
  expect(result).toMatchObject({
    measurable: true,
    sizesAvailable: false,
    heightToWidthRatio: 2,
    evidenceId: "reading-1",
  });
  expect(result).not.toHaveProperty("heightMm");
});

it("gives sizes once a scale exists, including the goal", async () => {
  const registry = createToolRegistry(
    dependencies({
      getScale: () => scale,
      getGoal: () => ({
        goal: {
          id: "g",
          targetId: target.id,
          basis: "wet",
          desiredHeightMm: 150,
          desiredMaximumWidthMm: null,
          shrinkageFraction: null,
        },
        wetHeightMm: 150,
        wetMaximumWidthMm: null,
        equation: "",
      }),
    }),
  );
  await expect(registry.call("getCurrentDimensions", {})).resolves.toMatchObject({
    sizesAvailable: true,
    heightMm: 120,
    maximumWidthMm: 60,
    goalHeightMm: 150,
  });
  await expect(registry.call("compareTargetProfile", {})).resolves.toMatchObject({
    sizesAvailable: true,
    heightProgressPercent: 80,
  });
});

it("compares shape only without a scale", async () => {
  const result = (await createToolRegistry(dependencies()).call("compareTargetProfile", {})) as {
    sizesAvailable: boolean;
    regions: Array<{ widerThanTargetPercent: number | null }>;
  };
  expect(result.sizesAvailable).toBe(false);
  expect(result.regions.some((region) => region.widerThanTargetPercent !== null)).toBe(true);
});

it("withholds stale or missing readings", async () => {
  const stale = createToolRegistry(dependencies({ getReading: () => pixelReading({ timestampMs: 0 }) }));
  await expect(stale.call("getCurrentDimensions", {})).resolves.toMatchObject({
    measurable: false,
    reason: "STALE_READING",
  });
  const empty = createToolRegistry(dependencies({ getReading: () => null }));
  await expect(empty.call("getCurrentDimensions", {})).resolves.toMatchObject({
    measurable: false,
    reason: "NO_CURRENT_READING",
  });
});

it("runs a spoken setup: propose, read back, confirm", async () => {
  const deps = dependencies();
  const registry = createToolRegistry(deps);
  const proposal = (await registry.call("proposeSetup", {
    wheelHeadDiameter: { value: 14, unit: "in" },
    goal: { height: { value: 15, unit: "cm" }, basis: "wet" },
  })) as { readback: string };
  expect(proposal.readback).toContain("15 centimetres (that's 1-5)");
  expect(deps.setup.getSnapshot().goal?.confirmed).toBe(false);
  await registry.call("confirmSetup", {});
  expect(deps.setup.getSnapshot().goal?.confirmed).toBe(true);
});

it("checks the wheel head only after its size is confirmed, then adjusts and confirms by voice", async () => {
  const wheel = {
    check: vi.fn(async () => ({ found: true, confidence: 0.9 })),
    adjust: vi.fn(),
    confirm: vi.fn(() => ({ accepted: true, problems: [] })),
    skip: vi.fn(),
  };
  const deps = dependencies({ wheel });
  const registry = createToolRegistry(deps);
  await expect(registry.call("checkWheelHead", {})).resolves.toMatchObject({ found: false });
  expect(wheel.check).not.toHaveBeenCalled();
  deps.setup.apply({ wheelHeadDiameter: { value: 14, unit: "in" } });
  await expect(registry.call("checkWheelHead", {})).resolves.toMatchObject({ found: true });
  await registry.call("adjustWheelMarker", { side: "left", direction: "out", size: "small" });
  expect(wheel.adjust).toHaveBeenCalledWith("left", "out", "small");
  await expect(registry.call("confirmWheelHead", {})).resolves.toMatchObject({ accepted: true });
});

it("asks before ending or deleting a session", async () => {
  const endSession = vi.fn(async () => undefined);
  const deleteSession = vi.fn(async () => undefined);
  const registry = createToolRegistry(dependencies({ endSession, deleteSession }));
  await expect(registry.call("endSession", { confirmed: false })).resolves.toHaveProperty("needsConfirmation");
  expect(endSession).not.toHaveBeenCalled();
  await registry.call("endSession", { confirmed: true });
  expect(endSession).toHaveBeenCalledOnce();
  await expect(registry.call("deleteSession", { confirmed: false })).resolves.toHaveProperty("needsConfirmation");
  await registry.call("deleteSession", { confirmed: true });
  expect(deleteSession).toHaveBeenCalledOnce();
});

it("says when a tool isn't available at this point in the session", async () => {
  await expect(createToolRegistry(dependencies()).call("getSessionSummary", {})).resolves.toMatchObject({
    available: false,
  });
});
