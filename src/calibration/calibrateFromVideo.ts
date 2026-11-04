import { captureFrame } from "../camera/captureFrame";
import { BOARD_V1, tagCornersMm } from "./boardV1";
import { boardPoseFromCalibration, wheelViewPoseFromBoardCalibration } from "./boardCalibration";
import { solveCalibration } from "./homography";
import { validateCalibration } from "./quality";
import type { TagDetector } from "./TagDetector";
import type { CalibrationResult, PointCorrespondence } from "./types";

/** Captures the current video frame, detects the board's AprilTags, and solves the image-to-board homography. */
export async function calibrateFromVideo(
  video: HTMLVideoElement,
  detector: TagDetector,
  wheelDiameterMm?: number,
): Promise<CalibrationResult> {
  const frame = captureFrame(video);
  const { width, height } = frame;
  const detections = await detector.detect(frame);
  const correspondences: PointCorrespondence[] = detections.flatMap((detection) => {
    const boardCorners = tagCornersMm(detection.id);
    return boardCorners
      ? detection.corners.map((image, index) => ({ tagId: detection.id, image, boardMm: boardCorners[index]! }))
      : [];
  });
  if (correspondences.length === 0)
    throw new Error("No calibration tags were found. Keep all four tags visible and retry.");
  const result = solveCalibration(correspondences, BOARD_V1.calibration, {
    ...(wheelDiameterMm === undefined ? {} : { boardPlacement: "wheel-plane" as const }),
    width,
    height,
    roi: { x: 0, y: 0, width, height },
    poseYawDeg: null,
    posePitchDeg: null,
    blurScore: 1,
    contrastScore: 1,
  });
  if (wheelDiameterMm === undefined) return result;
  result.wheelViewPose = wheelViewPoseFromBoardCalibration(result);
  result.boardPose = boardPoseFromCalibration(result, wheelDiameterMm);
  result.imageCenterlineX = result.boardPose.wheelCenterImage.x;
  result.reasons = validateCalibration(result);
  result.status = result.reasons.length === 0 ? "accepted" : "rejected";
  return result;
}
