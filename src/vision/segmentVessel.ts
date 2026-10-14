import type { BackgroundModel, LabImage } from "./backgroundModel";
import { closeMask, openMask } from "./morphology";

export type ExclusionRegion = { x: number; y: number; width: number; height: number };

export type SegmentationResult = {
  mask: Uint8Array;
  /** 1 for rows inside the vessel's vertical span whose edges were found away from the frame border. */
  rowReliability: Uint8Array;
  /** First and last image rows covered by the selected vessel component. */
  span: { top: number; bottom: number } | null;
  /** Reliable rows divided by rows in the vessel's span; 0 when no vessel was found. */
  reliableFraction: number;
  reasons: string[];
};

const WHEEL_BAND_FRACTION = 0.8;

/**
 * Separates the vessel from a background model and keeps the largest foreground component that
 * reaches the wheel band (the bottom 20% of the frame), which excludes detached hands and tools.
 */
export function segmentVessel(rectified: LabImage, model: BackgroundModel, exclusions: ExclusionRegion[]): SegmentationResult {
  const { width, height } = rectified;
  if (model.width !== width || model.height !== height) throw new Error("Background dimensions do not match frame");
  const initial = new Uint8Array(width * height);
  const threshold = model.distanceThreshold * model.distanceThreshold;
  for (let pixel = 0, offset = 0; pixel < initial.length; pixel += 1, offset += 3) {
    const dl = rectified.lab[offset]! - model.medianLab[offset]!;
    const da = rectified.lab[offset + 1]! - model.medianLab[offset + 1]!;
    const db = rectified.lab[offset + 2]! - model.medianLab[offset + 2]!;
    initial[pixel] = dl * dl + da * da + db * db > threshold ? 1 : 0;
  }
  for (const region of exclusions) {
    for (let y = Math.max(0, region.y); y < Math.min(height, region.y + region.height); y += 1) {
      for (let x = Math.max(0, region.x); x < Math.min(width, region.x + region.width); x += 1) initial[y * width + x] = 0;
    }
  }
  const cleaned = closeMask(openMask(initial, width, height, 3), width, height, 5);
  const selected = largestWheelComponent(cleaned, width, height);
  const mask = new Uint8Array(width * height);
  const rowReliability = new Uint8Array(height);
  const reasons: string[] = [];
  if (!selected) {
    reasons.push("NO_WHEEL_CONNECTED_COMPONENT");
    return { mask, rowReliability, span: null, reliableFraction: 0, reasons };
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
  return { mask, rowReliability, span: { top: selected.top, bottom: selected.bottom }, reliableFraction: reliableRows / spanRows, reasons };
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
      if (x > 0 && mask[index - 1] && !labels[index - 1]) { labels[index - 1] = nextLabel; queue[tail++] = index - 1; }
      if (x < width - 1 && mask[index + 1] && !labels[index + 1]) { labels[index + 1] = nextLabel; queue[tail++] = index + 1; }
      if (y > 0 && mask[index - width] && !labels[index - width]) { labels[index - width] = nextLabel; queue[tail++] = index - width; }
      if (y < height - 1 && mask[index + width] && !labels[index + width]) { labels[index + width] = nextLabel; queue[tail++] = index + width; }
    }
    if (bottom >= wheelBandStart && (!best || tail > best.size)) best = { label: nextLabel, size: tail, top, bottom };
  }
  return best ? { ...best, labels } : null;
}
