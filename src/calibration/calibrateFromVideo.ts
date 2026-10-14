import { BOARD_V1, tagCornersMm } from "./boardV1";
import { solveCalibration } from "./homography";
import type { TagDetector } from "./TagDetector";
import type { CalibrationResult, PointCorrespondence } from "./types";

/** Captures the current video frame, detects the board's AprilTags, and solves the image-to-board homography. */
export async function calibrateFromVideo(video: HTMLVideoElement, detector: TagDetector): Promise<CalibrationResult> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("The camera has not delivered a frame yet.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas capture is unavailable.");
  context.drawImage(video, 0, 0, width, height);
  const detections = await detector.detect(context.getImageData(0, 0, width, height));
  const correspondences: PointCorrespondence[] = detections.flatMap((detection) => {
    const boardCorners = tagCornersMm(detection.id);
    return boardCorners
      ? detection.corners.map((image, index) => ({ tagId: detection.id, image, boardMm: boardCorners[index]! }))
      : [];
  });
  if (correspondences.length === 0)
    throw new Error("No calibration tags were found. Keep all four tags visible and retry.");
  return solveCalibration(correspondences, BOARD_V1.calibration, {
    width,
    height,
    roi: { x: 0, y: 0, width, height },
    poseYawDeg: null,
    posePitchDeg: null,
    blurScore: 1,
    contrastScore: 1,
  });
}
