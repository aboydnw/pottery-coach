export type Point2 = { x: number; y: number };

export type CalibrationQuality = {
  tagCount: number;
  reprojectionErrorPx95: number;
  scaleVariationFraction: number;
  estimatedErrorMm95: number;
  poseYawDeg: number | null;
  posePitchDeg: number | null;
  blurScore: number;
  contrastScore: number;
  /** Present for complete-rim wheel calibration; null for legacy and board records. */
  ellipseFitResidualPx95?: number | null;
  /** Share of the wheel rim supported by image evidence. */
  visibleArcFraction?: number | null;
};

export type CalibrationMethod = "board" | "wheel-head" | "none";

/** Where the wheel head's edges were found, in full-resolution image pixels. */
export type WheelHeadMeasurement = { leftX: number; rightX: number; row: number; diameterMm: number };

export type CalibrationResult = {
  id: string;
  /** How scale was established: printed board, wheel-head diameter, or none (shape-only). */
  method: CalibrationMethod;
  createdAtMs: number;
  status: "accepted" | "manual-review" | "rejected";
  homographyImageToMm: [number, number, number, number, number, number, number, number, number];
  wheelBaseline: [Point2, Point2];
  wheelCenterlineXmm: number;
  roiImage: { x: number; y: number; width: number; height: number };
  markerPlaneOffsetToleranceMm: number;
  quality: CalibrationQuality;
  reasons: string[];
  provenance: "automatic" | "manual-assisted";
  boardRevision: string;
  supportedBoardRevision: string;
  roiClipped: boolean;
  /** Vertical axis of the wheel in full-resolution image pixels, when the method can locate it. */
  imageCenterlineX?: number;
  wheelHead?: WheelHeadMeasurement;
};

export type PointCorrespondence = { tagId: number; image: Point2; boardMm: Point2 };

export type CalibrationBoard = {
  revision: string;
  supportedRevision: string;
  wheelBaseline: [Point2, Point2];
  wheelCenterlineXmm: number;
  markerPlaneOffsetToleranceMm: number;
};

export type CalibrationFrame = {
  width: number;
  height: number;
  roi: { x: number; y: number; width: number; height: number };
  poseYawDeg: number | null;
  posePitchDeg: number | null;
  blurScore: number;
  contrastScore: number;
};
