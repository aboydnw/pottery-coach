export type AdaptiveMode = { processingHz: 10 | 7.5 | 5; roi: { width: 640; height: 360 }; reason: string };
export class AdaptiveRateController {
  private index = 0;
  private readonly rates = [10, 7.5, 5] as const;
  constructor(private onModeChange?: (mode: AdaptiveMode) => void) {}
  update(sample: { processingMsP95: number; frameAgeMsP95: number }): AdaptiveMode {
    const previous = this.index;
    const overloaded = sample.frameAgeMsP95 > 500 || sample.processingMsP95 > 100;
    const recovered = sample.frameAgeMsP95 < 250 && sample.processingMsP95 < 60;
    if (overloaded) this.index = Math.min(this.rates.length - 1, this.index + 1);
    else if (recovered) this.index = Math.max(0, this.index - 1);
    const mode: AdaptiveMode = { processingHz: this.rates[this.index]!, roi: { width: 640, height: 360 },
      reason: overloaded ? "latency-pressure" : recovered ? "recovered" : "stable" };
    if (previous !== this.index) this.onModeChange?.(mode);
    return mode;
  }
}
