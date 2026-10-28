import type { BackgroundModel } from "./backgroundModel";
import type { ClaySegmentationInput, ClaySegmentationOutput, ClaySegmenter } from "./ClaySegmenter";

export class BackgroundClaySegmenter implements ClaySegmenter {
  readonly version = "background-v1";

  constructor(private readonly background: BackgroundModel) {}

  async segment(input: ClaySegmentationInput): Promise<ClaySegmentationOutput> {
    return this.segmentSync(input);
  }

  segmentSync(input: ClaySegmentationInput): ClaySegmentationOutput {
    const startedAt = performance.now();
    const image = input.lab;
    if (!image) throw new Error("The background clay segmenter requires LAB image data");
    if (
      input.width !== this.background.width ||
      input.height !== this.background.height ||
      image.width !== input.width ||
      image.height !== input.height
    )
      throw new Error("Background dimensions do not match frame dimensions");
    const probability = new Float32Array(input.width * input.height);
    const thresholdSquared = this.background.distanceThreshold * this.background.distanceThreshold;
    for (let pixel = 0, offset = 0; pixel < probability.length; pixel += 1, offset += 3) {
      const dl = image.lab[offset]! - this.background.medianLab[offset]!;
      const da = image.lab[offset + 1]! - this.background.medianLab[offset + 1]!;
      const db = image.lab[offset + 2]! - this.background.medianLab[offset + 2]!;
      probability[pixel] = dl * dl + da * da + db * db > thresholdSquared ? 1 : 0;
    }
    return {
      width: input.width,
      height: input.height,
      probability,
      modelVersion: this.version,
      processingMs: performance.now() - startedAt,
    };
  }

  dispose(): void {}
}
