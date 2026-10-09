import type { BackgroundModel, LabImage } from "./backgroundModel";
import { closeMask, openMask } from "./morphology";

export type ExclusionRegion = { x: number; y: number; width: number; height: number };
export type SegmentationResult = { mask: Uint8Array; rowReliability: Uint8Array; reasons: string[] };

export function segmentVessel(
  rectified: LabImage,
  model: BackgroundModel,
  exclusions: ExclusionRegion[],
): SegmentationResult {
  const { width, height } = rectified;
  if (model.width !== width || model.height !== height) throw new Error("Background dimensions do not match frame");
  const initial = new Uint8Array(width * height);
  for (let pixel = 0; pixel < initial.length; pixel += 1) {
    const offset = pixel * 3;
    const distance = Math.hypot(
      rectified.lab[offset]! - model.medianLab[offset]!,
      rectified.lab[offset + 1]! - model.medianLab[offset + 1]!,
      rectified.lab[offset + 2]! - model.medianLab[offset + 2]!,
    );
    initial[pixel] = distance > model.distanceThreshold ? 1 : 0;
  }
  for (const region of exclusions) for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      if (x >= 0 && y >= 0 && x < width && y < height) initial[y * width + x] = 0;
    }
  }
  const cleaned = closeMask(openMask(initial, width, height, 3), width, height, 5);
  const components = connectedComponents(cleaned, width, height);
  const selected = components
    .filter((component) => component.some((index) => Math.floor(index / width) >= Math.floor(height * 0.8)))
    .sort((left, right) => right.length - left.length)[0];
  const mask = new Uint8Array(width * height);
  const reasons: string[] = [];
  if (!selected) reasons.push("NO_WHEEL_CONNECTED_COMPONENT");
  else selected.forEach((index) => { mask[index] = 1; });
  const rowReliability = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    const pixels: number[] = [];
    for (let x = 0; x < width; x += 1) if (mask[y * width + x]) pixels.push(x);
    rowReliability[y] = pixels.length >= 2 && pixels[0] !== 0 && pixels.at(-1) !== width - 1 ? 1 : 0;
  }
  if (rowReliability.some((value) => value === 0)) reasons.push("UNRELIABLE_ROWS");
  return { mask, rowReliability, reasons };
}

function connectedComponents(mask: Uint8Array, width: number, height: number): number[][] {
  const seen = new Uint8Array(mask.length);
  const components: number[][] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const component: number[] = [];
    const queue = [start]; seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!; component.push(index);
      const x = index % width; const y = Math.floor(index / width);
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) if (nx! >= 0 && ny! >= 0 && nx! < width && ny! < height) {
        const next = ny! * width + nx!;
        if (mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    components.push(component);
  }
  return components;
}
