import type { StableDimensionReading } from "../measurement/types";
import { median } from "../shared/stats";
import { compareShape } from "../targets/compareProfiles";
import type { ProfileRegion, TargetProfile } from "../targets/types";
import type { WobbleReading } from "../wobble/types";
import type { CoachingObservation } from "./evaluatePolicies";
import { cuePolicySchema } from "./policySchema";
import type { CueCandidate } from "./types";

/** Anthony approved the cue wording for this owner deployment on 2026-10-18. */
const OWNER_APPROVAL = "owner-2026-10-18";
const TWO_MINUTES = 120_000;

const shared = {
  revision: 2,
  maxFreshnessMs: 1_500,
  cooldownMs: TWO_MINUTES,
  prohibitedWording: ["press harder"],
  instructorApprovalId: OWNER_APPROVAL,
  mode: "proactive" as const,
  enabled: true,
};

/** The four things the coach speaks up about without being asked. */
export const LIVE_CUE_POLICIES = [
  {
    ...shared,
    id: "target-height-milestone",
    // Each milestone is spoken once per piece anyway, so only the global gap applies.
    cooldownMs: 0,
    trigger: "target-milestone",
    requiredConfidence: 0.75,
    minimumPersistenceMs: 1_000,
    priority: 3,
    suppressions: ["hands-on"],
    spokenExamples: ["You're at 80% of your goal height."],
    auditEvent: "height-milestone",
  },
  {
    ...shared,
    id: "target-regional-difference",
    trigger: "target-deviation",
    requiredConfidence: 0.75,
    minimumPersistenceMs: 2_000,
    priority: 4,
    suppressions: ["hands-on"],
    spokenExamples: ["Top's flaring, about 8% wider than your target."],
    auditEvent: "regional-correction",
  },
  {
    ...shared,
    id: "significant-visible-oscillation",
    trigger: "visible-oscillation",
    requiredConfidence: 0.75,
    minimumPersistenceMs: 3_000,
    priority: 2,
    suppressions: ["hands-on"],
    spokenExamples: ["I'm seeing some wobble at the rim."],
    auditEvent: "wobble-cue",
  },
  {
    ...shared,
    id: "uneven-walls",
    trigger: "uneven-walls",
    requiredConfidence: 0.75,
    minimumPersistenceMs: 2_000,
    priority: 4,
    suppressions: ["hands-on"],
    spokenExamples: ["Left side's bulging out more than the right."],
    auditEvent: "uneven-walls-cue",
  },
].map((policy) => cuePolicySchema.parse(policy));

const MILESTONES = [50, 80, 100] as const;
/** A region this far off the target's radius counts as flaring or pulling in. */
const DEVIATION_FRACTION = 0.1;
/** The top sitting this far (as a share of the pot's width) to one side of the base. */
const LEAN_FRACTION = 0.05;
const REGION_NAMES: Partial<Record<ProfileRegion, string>> = {
  rim: "Top",
  "upper-body": "Upper half",
  "lower-body": "Lower half",
};

/** The spoken line for a cue, built only from its measured facts. */
export function cueLine(cue: Pick<CueCandidate, "policyId" | "facts">): string {
  const { facts } = cue;
  switch (cue.policyId) {
    case "target-height-milestone":
      return `You're at ${String(facts.percent)}% of your goal height.`;
    case "target-regional-difference":
      return facts.direction === "wider"
        ? `${String(facts.region)}'s flaring, about ${String(facts.percent)}% wider than your target.`
        : `${String(facts.region)}'s pulling in, about ${String(facts.percent)}% narrower than your target.`;
    case "significant-visible-oscillation":
      return "I'm seeing some wobble at the rim.";
    case "uneven-walls":
      return `${String(facts.side)} side's bulging out more than the ${facts.side === "Left" ? "right" : "left"}.`;
    default:
      throw new Error(`No line for cue ${cue.policyId}`);
  }
}

type Found = Omit<CoachingObservation, "persistedMs" | "activeShaping"> & { key: string };

export type CueInputs = {
  /** The steady reading (pixels or millimetres); null while hands are on or nothing is measured. */
  reading: StableDimensionReading | null;
  /** The same reading in millimetres, once the wheel size is known. */
  sized: StableDimensionReading | null;
  wobble: WobbleReading | null;
  target: TargetProfile;
  goalHeightMm: number | null;
  handsLikely: boolean;
  nowMs: number;
};

/**
 * Turns live measurements into coaching observations, tracking how long each one has held so brief
 * flickers never become cues. Create a new one for each piece: milestones are announced once per piece.
 */
export class CueObserver {
  private readonly since = new Map<string, number>();

  constructor(private readonly pieceId: string) {}

  observe(inputs: CueInputs): CoachingObservation[] {
    const found: Found[] = [];
    const { reading, sized, nowMs } = inputs;
    if (reading) {
      const milestone = this.milestone(sized, inputs.goalHeightMm);
      if (milestone) found.push(milestone);
      const deviation = this.deviation(reading, inputs.target);
      if (deviation) found.push(deviation);
      const lean = this.lean(reading);
      if (lean) found.push(lean);
    }
    if (inputs.wobble?.classification === "significant-visible-oscillation") {
      found.push({
        kind: "visible-oscillation",
        key: "wobble",
        evidenceIds: [inputs.wobble.id],
        confidence: inputs.wobble.confidence,
        timestampMs: inputs.wobble.timestampMs,
        facts: {},
      });
    }
    const seen = new Set<string>();
    const observations = found.map(({ key, ...observation }) => {
      seen.add(key);
      if (!this.since.has(key)) this.since.set(key, nowMs);
      return {
        ...observation,
        persistedMs: nowMs - this.since.get(key)!,
        activeShaping: inputs.handsLikely,
      };
    });
    // Deleting the current key while iterating a Map is safe.
    for (const key of this.since.keys()) if (!seen.has(key)) this.since.delete(key);
    return observations;
  }

  private milestone(sized: StableDimensionReading | null, goalHeightMm: number | null): Found | null {
    if (!sized?.height || !goalHeightMm) return null;
    const percent = [...MILESTONES].reverse().find((value) => (sized.height! / goalHeightMm) * 100 >= value);
    if (!percent) return null;
    return {
      kind: "target-milestone",
      key: `milestone-${percent}`,
      // A fixed evidence id per piece and milestone, so the arbiter never repeats it.
      evidenceIds: [`${this.pieceId}-milestone-${percent}`],
      confidence: sized.confidence.overall,
      timestampMs: sized.timestampMs,
      facts: { percent },
    };
  }

  private deviation(reading: StableDimensionReading, target: TargetProfile): Found | null {
    const shape = compareShape(reading, target);
    if (!shape) return null;
    let worst: { region: string; fraction: number } | null = null;
    for (const region of shape.regions) {
      const name = REGION_NAMES[region.region];
      if (!name || region.signedMedianRadiusErrorMm === null) continue;
      const fraction = region.signedMedianRadiusErrorMm / targetRadiusMm(target, region.region);
      if (Math.abs(fraction) >= DEVIATION_FRACTION && (!worst || Math.abs(fraction) > Math.abs(worst.fraction)))
        worst = { region: name, fraction };
    }
    if (!worst) return null;
    const direction = worst.fraction > 0 ? "wider" : "narrower";
    return {
      kind: "target-deviation",
      key: `deviation-${worst.region}-${direction}`,
      evidenceIds: [shape.id],
      confidence: reading.confidence.overall,
      timestampMs: reading.timestampMs,
      facts: { region: worst.region, direction, percent: Math.round(Math.abs(worst.fraction) * 100) },
    };
  }

  private lean(reading: StableDimensionReading): Found | null {
    const lean = reading.leanOffset ?? null;
    if (lean === null || !reading.maximumWidth || Math.abs(lean) / reading.maximumWidth < LEAN_FRACTION) return null;
    // The camera faces the potter, so the image's right is the potter's left.
    const side = lean > 0 ? "Left" : "Right";
    return {
      kind: "uneven-walls",
      key: `lean-${side}`,
      evidenceIds: [reading.id],
      confidence: reading.confidence.overall,
      timestampMs: reading.timestampMs,
      facts: { side },
    };
  }
}

function targetRadiusMm(target: TargetProfile, region: ProfileRegion): number {
  const ranges: Record<ProfileRegion, [number, number]> = {
    base: [0, 0.1],
    "lower-body": [0.1, 0.5],
    "upper-body": [0.5, 0.9],
    rim: [0.9, 1.001],
  };
  const [start, end] = ranges[region];
  const ratios = target.normalizedRadiusByHeight
    .filter((sample) => sample.heightRatio >= start && sample.heightRatio < end)
    .map((sample) => sample.radiusToHeightRatio);
  return median(ratios.length ? ratios : [0.25]) * target.intendedWetHeightMm;
}
