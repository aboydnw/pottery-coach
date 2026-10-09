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
};

export type CalibrationResult = {
  id: string;
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
};

export type PointCorrespondence = { image: Point2; boardMm: Point2 };

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
