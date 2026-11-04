import type { LabImage } from "./backgroundModel";

export type ClaySegmentationInput = {
  width: number;
  height: number;
  /** Deterministic baseline input. A learned provider will consume RGBA instead. */
  lab?: LabImage;
  rgba?: Uint8ClampedArray;
};

export type ClaySegmentationOutput = {
  width: number;
  height: number;
  probability: Float32Array;
  modelVersion: string;
  processingMs: number;
};

export interface ClaySegmenter {
  readonly version: string;
  segment(input: ClaySegmentationInput): Promise<ClaySegmentationOutput>;
  dispose(): void;
}
