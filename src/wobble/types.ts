export type WobbleClassification = "visually-stable" | "minor-visible-oscillation" | "significant-visible-oscillation" | "rim-variation" | "shape-varies-with-rotation" | "source-ambiguous" | "unmeasurable";
export type TemporalContourSample = {
  timestampMs: number; frameId: number; centersMm: Array<number | null>; leftMm: Array<number | null>;
  rightMm: Array<number | null>; rimCenterMm: number | null; rimHeightMm: number | null;
  cameraTransformConfidence: number; occluded: boolean; shapeChangeRate: number;
};
export type WobbleReading = {
  id: string; timestampMs: number; amplitudeMm: number | null; periodMs: number | null;
  classification: WobbleClassification; confidence: number; evidenceWindowMs: number;
  observedRevolutions: number; validSampleFraction: number; cameraMotionRmsMm: number | null;
  lastReliableTimestampMs: number | null; reasons: string[]; sourceFrameIds: number[];
};
