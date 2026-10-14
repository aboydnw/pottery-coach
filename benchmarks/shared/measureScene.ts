import { extractDimensions } from "../../src/measurement/extractProfile";
import { buildBackground } from "../../src/vision/backgroundModel";
import { segmentVessel } from "../../src/vision/segmentVessel";
import { renderBackground, renderVessel, type VesselScene } from "./syntheticScene";

/** Runs the product segmentation and dimension extraction on a synthetic scene, as the worker does. */
export function measureScene(scene: VesselScene) {
  const background = buildBackground(Array.from({ length: 5 }, (_, frame) => renderBackground(scene, frame)));
  const image = renderVessel(scene);
  const segmentation = segmentVessel(image, background, []);
  const reading = extractDimensions(segmentation.mask, segmentation.rowReliability, {
    width: image.width,
    height: image.height,
    mmPerPixel: scene.mmPerPixel,
    centerlineX: image.width / 2,
    calibrationId: "synthetic",
    frameId: 1,
    timestampMs: 0,
  });
  return { segmentation, reading, measurable: segmentation.reliableFraction >= 0.75 && reading.heightMm !== null };
}
