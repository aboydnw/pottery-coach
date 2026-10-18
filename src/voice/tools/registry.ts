import { z } from "zod";

import { proportionsOf, toMm } from "../../measurement/scale";
import type { StableDimensionReading } from "../../measurement/types";
import { compareProfiles, compareShape } from "../../targets/compareProfiles";
import { median } from "../../shared/stats";
import type { ToolDependencies } from "./types";

const FRESH_MS = 750;
const MIN_CONFIDENCE = 0.8;
const empty = z.object({}).strict();
const length = z.object({ value: z.number().positive(), unit: z.enum(["mm", "cm", "in"]) }).strict();
const proposeSchema = z
  .object({
    wheelHeadDiameter: length.optional(),
    targetId: z.enum(["straight-cylinder-v1", "tapered-cylinder-v1"]).optional(),
    goal: z
      .object({ height: length, basis: z.enum(["wet", "fired"]), shrinkagePercent: z.number().nullable().optional() })
      .strict()
      .optional(),
  })
  .strict();
const confirmedSchema = z.object({ confirmed: z.boolean() }).strict();
const markerSchema = z
  .object({ side: z.enum(["left", "right"]), direction: z.enum(["in", "out"]), size: z.enum(["small", "large"]) })
  .strict();

const NOT_NOW = { available: false, reason: "That isn't available right now." };

/**
 * Executes the realtime model's tool calls against the live session. Arguments are validated here,
 * units are converted in code, and every measurement answer carries its evidence id and confidence.
 */
export function createToolRegistry(dependencies: ToolDependencies) {
  const { setup } = dependencies;

  function eligibleReading(): { reading: StableDimensionReading } | { unavailable: Record<string, unknown> } {
    const reading = dependencies.getReading();
    const timestampMs = dependencies.now();
    if (!reading)
      return { unavailable: { measurable: false, reason: "NO_CURRENT_READING", timestampMs, confidence: 0 } };
    const freshnessMs = timestampMs - reading.timestampMs;
    if (freshnessMs > FRESH_MS || reading.confidence.overall < MIN_CONFIDENCE) {
      return {
        unavailable: {
          measurable: false,
          reason: freshnessMs > FRESH_MS ? "STALE_READING" : "LOW_CONFIDENCE",
          evidenceId: reading.id,
          timestampMs: reading.timestampMs,
          confidence: reading.confidence.overall,
        },
      };
    }
    return { reading };
  }

  const tools: Record<string, (input: unknown) => Promise<unknown> | unknown> = {
    getSetupStatus: (input) => (parse(empty, input), setup.status()),
    proposeSetup: (input) => setup.propose(parse(proposeSchema, input)),
    confirmSetup: (input) => (parse(empty, input), setup.confirm()),
    loadLastSetup: (input) => {
      parse(empty, input);
      return setup.loadLast() ?? { found: false };
    },
    checkWheelHead: async (input) => {
      const { fresh = false } = parse(z.object({ fresh: z.boolean().optional() }).strict(), input);
      if (!dependencies.wheel) return NOT_NOW;
      if (!setup.getSnapshot().wheelHeadDiameterMm?.confirmed) {
        return { found: false, problem: "Ask for the wheel-head (or bat) diameter and confirm it first." };
      }
      const check = await dependencies.wheel.check(fresh);
      return {
        ...check,
        question: check.found
          ? "Ask: are the yellow lines on the outer edges of the wheel head? They can say yes, or which side to move."
          : "The edges weren't clear. Ask them to say which marker to move, or to skip sizes.",
      };
    },
    adjustWheelMarker: (input) => {
      const { side, direction, size } = parse(markerSchema, input);
      if (!dependencies.wheel) return NOT_NOW;
      dependencies.wheel.adjust(side, direction, size);
      return { moved: true, question: "Ask whether the markers are on the edges now." };
    },
    confirmWheelHead: (input) => {
      parse(empty, input);
      if (!dependencies.wheel) return NOT_NOW;
      const result = dependencies.wheel.confirm();
      return result.accepted
        ? { accepted: true, note: "Sizes are now available, including for earlier readings." }
        : result;
    },
    skipCalibration: (input) => {
      parse(empty, input);
      dependencies.wheel?.skip();
      setup.setCalibration("skipped");
      return { skipped: true, note: "Only shapes and proportions will be available." };
    },
    getCurrentDimensions: (input) => {
      parse(empty, input);
      const eligible = eligibleReading();
      if ("unavailable" in eligible) return eligible.unavailable;
      const { reading } = eligible;
      const base = {
        measurable: true,
        evidenceId: reading.id,
        timestampMs: reading.timestampMs,
        confidence: reading.confidence.overall,
        freshnessMs: dependencies.now() - reading.timestampMs,
      };
      const millimetres = toMm(reading, dependencies.getScale());
      if (!millimetres) {
        const proportions = proportionsOf(reading);
        return {
          ...base,
          sizesAvailable: false,
          heightToWidthRatio: round(proportions.heightToWidth, 100),
          rimToBaseRatio: round(proportions.rimToBase, 100),
          note: "No size scale yet; give proportions only. Sizes need the wheel-head check.",
        };
      }
      const goal = dependencies.getGoal();
      return {
        ...base,
        sizesAvailable: true,
        heightMm: round(millimetres.height),
        maximumWidthMm: round(millimetres.maximumWidth),
        rimWidthMm: round(millimetres.rimWidth),
        baseWidthMm: round(millimetres.baseWidth),
        goalHeightMm: goal ? round(goal.wetHeightMm) : null,
      };
    },
    getWobbleStatus: (input) => {
      parse(empty, input);
      if (!dependencies.getScale()) {
        return { measurable: false, reason: "NEEDS_SIZE_SCALE", timestampMs: dependencies.now(), confidence: 0 };
      }
      const value = dependencies.getWobble();
      return value
        ? {
            evidenceId: value.id,
            timestampMs: value.timestampMs,
            confidence: value.confidence,
            classification: value.classification,
            amplitudeMm: round(value.amplitudeMm),
            reasons: value.reasons,
          }
        : { measurable: false, reason: "NO_WOBBLE_EVIDENCE", timestampMs: dependencies.now(), confidence: 0 };
    },
    compareTargetProfile: (input) => {
      parse(empty, input);
      const eligible = eligibleReading();
      if ("unavailable" in eligible) return eligible.unavailable;
      const { reading } = eligible;
      const target = dependencies.getTarget();
      const goal = dependencies.getGoal();
      const millimetres = toMm(reading, dependencies.getScale());
      if (millimetres && goal) {
        const comparison = compareProfiles(millimetres, { ...target, intendedWetHeightMm: goal.wetHeightMm });
        return {
          evidenceId: comparison.id,
          timestampMs: comparison.timestampMs,
          confidence: comparison.confidence.overall,
          sizesAvailable: true,
          heightProgressPercent:
            millimetres.height === null ? null : Math.round((millimetres.height / goal.wetHeightMm) * 100),
          meanAbsoluteRadiusErrorMm: round(comparison.meanAbsoluteRadiusErrorMm),
          regions: comparison.regions.map((region) => ({
            region: region.region,
            signedRadiusErrorMm: round(region.signedMedianRadiusErrorMm),
            coverage: round(region.coverage, 100),
          })),
        };
      }
      const shape = compareShape(reading, target);
      if (!shape) return { measurable: false, reason: "NO_PROFILE", timestampMs: dependencies.now(), confidence: 0 };
      const targetRadiusMm =
        median(target.normalizedRadiusByHeight.map((sample) => sample.radiusToHeightRatio)) *
        target.intendedWetHeightMm;
      return {
        evidenceId: shape.id,
        timestampMs: shape.timestampMs,
        confidence: shape.confidence.overall,
        sizesAvailable: false,
        note: millimetres ? "No goal height yet; shape only." : "No size scale yet; shape only.",
        regions: shape.regions.map((region) => ({
          region: region.region,
          widerThanTargetPercent:
            region.signedMedianRadiusErrorMm === null
              ? null
              : Math.round((region.signedMedianRadiusErrorMm / targetRadiusMm) * 100),
        })),
      };
    },
    getMeasurementConfidence: (input) => {
      parse(empty, input);
      const reading = dependencies.getReading();
      if (!reading) {
        return { measurable: false, reason: "NO_CURRENT_READING", timestampMs: dependencies.now(), confidence: 0 };
      }
      const millimetres = toMm(reading, dependencies.getScale());
      return {
        evidenceId: reading.id,
        timestampMs: reading.timestampMs,
        confidence: (millimetres ?? reading).confidence,
        sizesAvailable: millimetres !== null,
      };
    },
    pauseCoaching: (input) => {
      parse(empty, input);
      dependencies.setPaused(true);
      return { paused: true, timestampMs: dependencies.now() };
    },
    resumeCoaching: (input) => {
      parse(empty, input);
      dependencies.setPaused(false);
      return { paused: false, timestampMs: dependencies.now() };
    },
    markMoment: (input) =>
      dependencies.markMoment
        ? dependencies.markMoment(parse(z.object({ label: z.string().max(100).optional() }).strict(), input))
        : NOT_NOW,
    endSession: async (input) => {
      const { confirmed } = parse(confirmedSchema, input);
      if (!dependencies.endSession) return NOT_NOW;
      if (!confirmed) {
        return { needsConfirmation: "Ask: end the session now? The camera stops and you'll hear a short summary." };
      }
      await dependencies.endSession();
      return {
        ended: true,
        summary: (await dependencies.getSessionSummary?.()) ?? null,
        next: "Give a debrief of one or two sentences from the summary, then say goodbye. The call ends when you finish.",
      };
    },
  };

  return {
    names: Object.keys(tools),
    async call(name: string, input: unknown): Promise<unknown> {
      const tool = tools[name];
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      return tool(input ?? {});
    },
  };
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid tool arguments: ${result.error.message}`);
  return result.data;
}

function round(value: number | null, factor = 10): number | null {
  return value === null ? null : Math.round(value * factor) / factor;
}
