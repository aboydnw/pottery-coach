import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { StableDimensionReading } from "../measurement/types";
import { SessionRepository } from "../session/SessionRepository";
import type { SessionRecord } from "../session/types";
import { useSessionRecording } from "./useSessionRecording";

let repository: DeferredCreateRepository | null = null;

afterEach(async () => {
  await repository?.destroy();
  repository = null;
});

class DeferredCreateRepository extends SessionRepository {
  private releaseCreate!: () => void;
  private readonly createGate = new Promise<void>((resolve) => {
    this.releaseCreate = resolve;
  });

  override async create(record: SessionRecord): Promise<void> {
    await this.createGate;
    await super.create(record);
  }

  release(): void {
    this.releaseCreate();
  }
}

it("keeps a reading that arrives while the new session is being created", async () => {
  repository = new DeferredCreateRepository(`test-${crypto.randomUUID()}`);
  const { result } = renderHook(() => useSessionRecording(repository!, vi.fn()));
  act(() => {
    void result.current.begin();
    result.current.recordReading(reading());
  });
  repository.release();
  const bundle = await result.current.end();

  expect(bundle.readings).toHaveLength(1);
  expect(bundle.readings[0]?.values.height).toBe(120);
});

function reading(): StableDimensionReading {
  return {
    id: "reading-1",
    timestampMs: Date.now(),
    unit: "mm",
    height: 120,
    maximumWidth: 80,
    rimWidth: 70,
    baseWidth: 60,
    centerlineOffset: 0,
    profile: [],
    visibleAsymmetry: 0,
    sourceFrameId: 1,
    calibrationId: "calibration-1",
    confidence: {
      overall: 0.9,
      calibration: { score: 0.9, reasons: [] },
      segmentation: { score: 0.9, reasons: [] },
      occlusion: { score: 0.9, reasons: [] },
      temporalStability: { score: 0.9, reasons: [] },
      freshnessMs: 0,
      estimatedError95: 1,
    },
    windowStartMs: Date.now() - 500,
    contributingFrameCount: 5,
    lastReliableTimestampMs: Date.now(),
  };
}
