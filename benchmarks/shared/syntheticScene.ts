import type { LabImage } from "../../src/vision/backgroundModel";

export type Lab = [number, number, number];

export type VesselScene = {
  width: number;
  height: number;
  mmPerPixel: number;
  vesselHeightMm: number;
  radiusMm(heightRatio: number): number;
  centerOffsetMm: number;
  shearDeg: number;
  baseRow: number;
  background: Lab;
  clay: Lab;
  noise: number;
  seed: number;
  /** Lightness added to every pixel, simulating a global exposure change after the background was learned. */
  brightnessShift?: number;
  /** Lightness slope across the frame, present in both background and vessel frames. */
  sideLightGradient?: number;
  /** Darkens the vessel's left half, simulating a cast shadow. */
  shadow?: boolean;
  /** Fraction of vessel rows covered by a hand reaching in from the left edge. */
  occlusionFraction?: number;
};

/** Renders a frame of the background only, so the segmentation background model can be learned. */
export function renderBackground(scene: VesselScene, frame: number): LabImage {
  return render(scene, frame, false);
}

/** Renders a frame containing the vessel (and optional hand) on the same background. */
export function renderVessel(scene: VesselScene): LabImage {
  return render(scene, 1_000, true);
}

function render(scene: VesselScene, frame: number, withVessel: boolean): LabImage {
  const { width, height } = scene;
  const random = seeded(scene.seed * 7919 + frame);
  const lab = new Float32Array(width * height * 3);
  const vesselRows = scene.vesselHeightMm / scene.mmPerPixel;
  const topRow = scene.baseRow - vesselRows;
  const occludedRows = vesselRows * (scene.occlusionFraction ?? 0);
  const handTop = topRow + vesselRows * 0.3;
  for (let y = 0; y < height; y += 1) {
    const ratio = (scene.baseRow - y) / vesselRows;
    const radiusPx = scene.radiusMm(Math.min(1, Math.max(0, ratio))) / scene.mmPerPixel;
    const center =
      width / 2 +
      scene.centerOffsetMm / scene.mmPerPixel +
      Math.tan((scene.shearDeg * Math.PI) / 180) * (scene.baseRow - y);
    for (let x = 0; x < width; x += 1) {
      const gradient = (scene.sideLightGradient ?? 0) * (x / width - 0.5);
      let color: Lab = scene.background;
      let shift = gradient;
      if (withVessel) {
        shift += scene.brightnessShift ?? 0;
        const insideVessel = y >= topRow && y <= scene.baseRow && Math.abs(x - center) <= radiusPx;
        if (insideVessel) {
          color = scene.clay;
          if (scene.shadow && x < center) shift -= 15;
        }
        const inHand = occludedRows > 0 && y >= handTop && y < handTop + occludedRows && x < center + radiusPx * 0.3;
        if (inHand) color = [62, 18, 22];
      }
      const offset = (y * width + x) * 3;
      lab[offset] = color[0] + shift + (random() - 0.5) * 2 * scene.noise;
      lab[offset + 1] = color[1] + (random() - 0.5) * scene.noise;
      lab[offset + 2] = color[2] + (random() - 0.5) * scene.noise;
    }
  }
  return { width, height, lab };
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32;
}
