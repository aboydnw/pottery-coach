import { describe, expect, it } from "vitest";
import type { StableDimensionReading } from "../measurement/types";
import { loadTemplates } from "../targets/loadTemplates";
import type { WobbleReading } from "../wobble/types";
import { CueArbiter } from "./CueArbiter";
import { evaluatePolicies } from "./evaluatePolicies";
import { CueObserver, cueLine, LIVE_CUE_POLICIES, type CueInputs } from "./liveCues";

const target = loadTemplates().find((template) => template.id === "straight-cylinder-v1")!;

function reading({
  height = 300,
  rimFlare = 1,
  leanOffset = 0,
  id = "r1",
}: { height?: number; rimFlare?: number; leanOffset?: number; id?: string } = {}): StableDimensionReading {
  const ratioAt = (heightRatio: number) =>
    target.normalizedRadiusByHeight.reduce((best, sample) =>
      Math.abs(sample.heightRatio - heightRatio) < Math.abs(best.heightRatio - heightRatio) ? sample : best,
    ).radiusToHeightRatio;
  const profile = Array.from({ length: 64 }, (_, index) => {
    const heightRatio = index / 63;
    const radius = ratioAt(heightRatio) * height * (heightRatio >= 0.9 ? rimFlare : 1);
    return { heightRatio, radius, confidence: 1 };
  });
  return {
    id,
    timestampMs: 0,
    sourceFrameId: 1,
    calibrationId: "c",
    unit: "mm",
    height,
    maximumWidth: 100,
    rimWidth: 100,
    baseWidth: 100,
    centerlineOffset: 0,
    profile,
    visibleAsymmetry: 0,
    leanOffset,
    confidence: {
      overall: 0.9,
      calibration: { score: 1, reasons: [] },
      segmentation: { score: 1, reasons: [] },
      occlusion: { score: 1, reasons: [] },
      temporalStability: { score: 1, reasons: [] },
      freshnessMs: 0,
      estimatedError95: null,
    },
    windowStartMs: 0,
    contributingFrameCount: 5,
    lastReliableTimestampMs: 0,
  };
}

function inputs(overrides: Partial<CueInputs>): CueInputs {
  const base = reading();
  return {
    reading: base,
    sized: base,
    wobble: null,
    target,
    goalHeightMm: null,
    handsLikely: false,
    nowMs: 0,
    ...overrides,
  };
}

describe("CueObserver", () => {
  it("reports the highest height milestone reached, once it has held", () => {
    const observer = new CueObserver("piece-1");
    const sized = reading({ height: 125 });
    observer.observe(inputs({ sized, goalHeightMm: 150, nowMs: 0 }));
    const [milestone] = observer.observe(inputs({ sized, goalHeightMm: 150, nowMs: 1_200 }));
    expect(milestone).toMatchObject({
      kind: "target-milestone",
      facts: { percent: 80 },
      persistedMs: 1_200,
      evidenceIds: ["piece-1-milestone-80"],
    });
  });

  it("spots a flaring top against the target shape, even without sizes", () => {
    const observer = new CueObserver("piece-1");
    const flared = reading({ rimFlare: 1.3 });
    const observations = observer.observe(inputs({ reading: flared, sized: null }));
    expect(observations.find((item) => item.kind === "target-deviation")?.facts).toMatchObject({
      region: "Top",
      direction: "wider",
    });
  });

  it("ignores a pot that matches the target", () => {
    expect(new CueObserver("piece-1").observe(inputs({}))).toEqual([]);
  });

  it("reads a lean towards the image's right as the potter's left side bulging", () => {
    const observations = new CueObserver("piece-1").observe(inputs({ reading: reading({ leanOffset: 10 }) }));
    expect(observations.find((item) => item.kind === "uneven-walls")?.facts).toEqual({ side: "Left" });
  });

  it("reports significant wobble", () => {
    const wobble = {
      id: "w1",
      timestampMs: 0,
      confidence: 0.9,
      classification: "significant-visible-oscillation",
    } as WobbleReading;
    expect(new CueObserver("piece-1").observe(inputs({ wobble }))[0]?.kind).toBe("visible-oscillation");
  });

  it("restarts the clock when an observation goes away", () => {
    const observer = new CueObserver("piece-1");
    const flared = reading({ rimFlare: 1.3 });
    observer.observe(inputs({ reading: flared, nowMs: 0 }));
    observer.observe(inputs({ nowMs: 1_000 }));
    const [again] = observer.observe(inputs({ reading: flared, nowMs: 2_000 }));
    expect(again?.persistedMs).toBe(0);
  });

  it("marks observations made with hands on the pot", () => {
    const [observation] = new CueObserver("piece-1").observe(
      inputs({ reading: reading({ rimFlare: 1.3 }), handsLikely: true }),
    );
    expect(observation?.activeShaping).toBe(true);
  });
});

describe("cue lines", () => {
  it("phrases each cue in the approved wording", () => {
    expect(cueLine({ policyId: "target-height-milestone", facts: { percent: 80 } })).toBe(
      "You're at 80% of your goal height.",
    );
    expect(
      cueLine({ policyId: "target-regional-difference", facts: { region: "Top", direction: "wider", percent: 8 } }),
    ).toBe("Top's flaring, about 8% wider than your target.");
    expect(cueLine({ policyId: "significant-visible-oscillation", facts: {} })).toBe(
      "I'm seeing some wobble at the rim.",
    );
    expect(cueLine({ policyId: "uneven-walls", facts: { side: "Left" } })).toBe(
      "Left side's bulging out more than the right.",
    );
  });
});

describe("live cue policies", () => {
  it("are approved and enabled, and speak a milestone only once per piece", () => {
    expect(LIVE_CUE_POLICIES.every((policy) => policy.enabled)).toBe(true);
    let clock = 10_000;
    const arbiter = new CueArbiter(() => clock);
    const observer = new CueObserver("piece-1");
    const sized = reading({ height: 125 });
    const spoken: string[] = [];
    for (const nowMs of [0, 1_500, 30_000, 200_000]) {
      clock = 10_000 + nowMs;
      const candidates = observer
        .observe(inputs({ sized, goalHeightMm: 150, nowMs }))
        .flatMap((observation) => evaluatePolicies({ ...observation, timestampMs: clock }, LIVE_CUE_POLICIES, clock));
      const { speak } = arbiter.consider(candidates, { userSpeaking: false, activeShaping: false, occluded: false });
      if (speak) {
        arbiter.markSpoken(speak);
        spoken.push(cueLine(speak));
      }
    }
    expect(spoken).toEqual(["You're at 80% of your goal height."]);
  });
});
