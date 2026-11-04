import { closeMask, openMask } from "./morphology";
import type { ClaySegmentationOutput } from "./ClaySegmenter";
import type { ExclusionRegion, SegmentationResult } from "./segmentVessel";

const WHEEL_BAND_FRACTION = 0.8;

export function cleanClayProbability(
  output: ClaySegmentationOutput,
  options: { threshold: number; exclusions: ExclusionRegion[] },
): SegmentationResult & { modelVersion: string } {
  const { width, height } = output;
  if (output.probability.length !== width * height) throw new Error("Clay probability dimensions do not match output");
  const initial = new Uint8Array(width * height);
  for (let index = 0; index < initial.length; index += 1)
    initial[index] = output.probability[index]! >= options.threshold ? 1 : 0;
  for (const region of options.exclusions) {
    for (let y = Math.max(0, region.y); y < Math.min(height, region.y + region.height); y += 1)
      for (let x = Math.max(0, region.x); x < Math.min(width, region.x + region.width); x += 1)
        initial[y * width + x] = 0;
  }
  const cleaned = closeMask(openMask(initial, width, height, 3), width, height, 5);
  const selected = largestWheelComponent(cleaned, width, height);
  const mask = new Uint8Array(width * height);
  const rowReliability = new Uint8Array(height);
  const reasons: string[] = [];
  if (!selected) {
    reasons.push("NO_WHEEL_CONNECTED_COMPONENT");
    return { mask, rowReliability, span: null, reliableFraction: 0, reasons, modelVersion: output.modelVersion };
  }
  for (let index = 0; index < mask.length; index += 1) if (selected.labels[index] === selected.label) mask[index] = 1;
  let reliableRows = 0;
  for (let y = selected.top; y <= selected.bottom; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      if (left < 0) left = x;
      right = x;
    }
    const reliable = left >= 0 && right > left && left !== 0 && right !== width - 1;
    rowReliability[y] = reliable ? 1 : 0;
    if (reliable) reliableRows += 1;
  }
  const spanRows = selected.bottom - selected.top + 1;
  if (reliableRows < spanRows) reasons.push("UNRELIABLE_ROWS");
  return {
    mask,
    rowReliability,
    span: { top: selected.top, bottom: selected.bottom },
    reliableFraction: reliableRows / spanRows,
    reasons,
    modelVersion: output.modelVersion,
  };
}

function largestWheelComponent(mask: Uint8Array, width: number, height: number) {
  const labels = new Int32Array(mask.length);
  const queue = new Int32Array(mask.length);
  const wheelBandStart = Math.floor(height * WHEEL_BAND_FRACTION);
  let best: { label: number; size: number; top: number; bottom: number } | null = null;
  let nextLabel = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;
    nextLabel += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = nextLabel;
    let top = height;
    let bottom = -1;
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      const y = (index - x) / width;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x > 0 && mask[index - 1] && !labels[index - 1]) {
        labels[index - 1] = nextLabel;
        queue[tail++] = index - 1;
      }
      if (x < width - 1 && mask[index + 1] && !labels[index + 1]) {
        labels[index + 1] = nextLabel;
        queue[tail++] = index + 1;
      }
      if (y > 0 && mask[index - width] && !labels[index - width]) {
        labels[index - width] = nextLabel;
        queue[tail++] = index - width;
      }
      if (y < height - 1 && mask[index + width] && !labels[index + width]) {
        labels[index + width] = nextLabel;
        queue[tail++] = index + width;
      }
    }
    if (bottom >= wheelBandStart && (!best || tail > best.size)) best = { label: nextLabel, size: tail, top, bottom };
  }
  return best ? { ...best, labels } : null;
}
