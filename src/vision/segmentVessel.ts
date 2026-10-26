import type { BackgroundModel, LabImage } from "./backgroundModel";
import { BackgroundClaySegmenter } from "./BackgroundClaySegmenter";
import { cleanClayProbability } from "./clayMask";

export type ExclusionRegion = { x: number; y: number; width: number; height: number };

export type SegmentationResult = {
  mask: Uint8Array;
  /** 1 for rows inside the vessel's vertical span whose edges were found away from the frame border. */
  rowReliability: Uint8Array;
  /** First and last image rows covered by the selected vessel component. */
  span: { top: number; bottom: number } | null;
  /** Reliable rows divided by rows in the vessel's span; 0 when no vessel was found. */
  reliableFraction: number;
  reasons: string[];
  modelVersion?: string;
};

/** Deterministic baseline facade retained for existing consumers and comparisons with learned models. */
export function segmentVessel(
  rectified: LabImage,
  model: BackgroundModel,
  exclusions: ExclusionRegion[],
): SegmentationResult {
  const provider = new BackgroundClaySegmenter(model);
  const output = provider.segmentSync({ width: rectified.width, height: rectified.height, lab: rectified });
  return cleanClayProbability(output, { threshold: 0.5, exclusions });
}
