import { describe, expect, it } from "vitest";

import { FrameDiagnostics } from "./FrameDiagnostics";

describe("FrameDiagnostics", () => {
  it("reports sliding-window rates independently for each clock", () => {
    const diagnostics = new FrameDiagnostics(1000);
    diagnostics.record("preview", 100);
    diagnostics.record("preview", 600);
    diagnostics.record("acquired", 600, 1);
    diagnostics.record("processed", 800, 1);

    const sample = diagnostics.snapshot(1000);

    expect(sample.previewFps).toBe(2);
    expect(sample.acquiredFps).toBe(1);
    expect(sample.processedFps).toBe(1);
  });

  it("calculates p50 and p95 frame age from rendered frames", () => {
    const diagnostics = new FrameDiagnostics(10_000);
    for (let frameId = 1; frameId <= 20; frameId += 1) {
      diagnostics.record("acquired", 1000, frameId);
      diagnostics.record("rendered", 1000 + frameId * 10, frameId);
    }

    const sample = diagnostics.snapshot(1500);

    expect(sample.frameAgeMsP50).toBe(100);
    expect(sample.frameAgeMsP95).toBe(190);
  });

  it("counts missing acquired frame ids as dropped", () => {
    const diagnostics = new FrameDiagnostics();
    diagnostics.record("acquired", 100, 1);
    diagnostics.record("acquired", 200, 4);

    expect(diagnostics.snapshot(300).droppedFrames).toBe(2);
  });

  it("clears rates and ages after an interruption reset", () => {
    const diagnostics = new FrameDiagnostics();
    diagnostics.record("preview", 100);
    diagnostics.record("acquired", 100, 1);
    diagnostics.record("rendered", 140, 1);

    diagnostics.reset();

    expect(diagnostics.snapshot(200)).toEqual(
      expect.objectContaining({
        previewFps: 0,
        acquiredFps: 0,
        frameAgeMsP50: 0,
        frameAgeMsP95: 0,
        droppedFrames: 0,
      }),
    );
  });
});
