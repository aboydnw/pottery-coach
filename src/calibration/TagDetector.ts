import type { Point2 } from "./types";

export type TagDetection = {
  id: number;
  corners: [Point2, Point2, Point2, Point2];
  decisionMargin: number;
};

export interface TagDetector {
  detect(frame: ImageData): Promise<TagDetection[]>;
  dispose(): void;
}
