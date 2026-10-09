export type PeriodSample = { timestampMs: number; value: number };
export type PeriodEstimate = { periodMs: number; confidence: number; amplitude: number; noise: number };

export function estimatePeriod(samples: PeriodSample[], range: { minMs: number; maxMs: number }): PeriodEstimate | null {
  if (samples.length < 20) return null;
  const times = samples.map((sample) => sample.timestampMs);
  const values = detrend(samples);
  const variance = values.reduce((sum, value) => sum + value * value, 0);
  if (variance < 1e-9) return null;
  let best: PeriodEstimate | null = null;
  for (let period = range.minMs; period <= range.maxMs; period += 5) {
    let ss = 0; let cc = 0; let sy = 0; let cy = 0;
    for (let index = 0; index < values.length; index += 1) {
      const phase = 2 * Math.PI * times[index]! / period;
      const sine = Math.sin(phase); const cosine = Math.cos(phase);
      ss += sine * sine; cc += cosine * cosine; sy += sine * values[index]!; cy += cosine * values[index]!;
    }
    const a = sy / ss; const b = cy / cc;
    let residual = 0;
    for (let index = 0; index < values.length; index += 1) {
      const phase = 2 * Math.PI * times[index]! / period;
      const error = values[index]! - a * Math.sin(phase) - b * Math.cos(phase);
      residual += error * error;
    }
    const confidence = Math.max(0, 1 - residual / variance);
    const candidate = { periodMs: period, confidence, amplitude: Math.hypot(a, b), noise: Math.sqrt(residual / values.length) };
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }
  if (!best || best.confidence < 0.6 || best.amplitude <= 3 * best.noise) return null;
  return best;
}

function detrend(samples: PeriodSample[]): number[] {
  const meanT = samples.reduce((sum, sample) => sum + sample.timestampMs, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length;
  let numerator = 0; let denominator = 0;
  for (const sample of samples) { numerator += (sample.timestampMs - meanT) * (sample.value - meanY); denominator += (sample.timestampMs - meanT) ** 2; }
  const slope = denominator ? numerator / denominator : 0;
  return samples.map((sample) => sample.value - (meanY + slope * (sample.timestampMs - meanT)));
}
