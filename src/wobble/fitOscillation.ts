export type OscillationSample = { timestampMs: number; value: number; weight?: number };
export type FitResult = { amplitudeMm: number; residualRmsMm: number; phaseRad: number; offsetMm: number; trendMmPerMs: number };

export function fitOscillation(samples: OscillationSample[], periodMs: number): FitResult {
  if (samples.length < 8 || periodMs <= 0) throw new Error("Insufficient oscillation samples");
  const origin = samples[0]!.timestampMs;
  const normal = Array.from({ length: 4 }, () => Array(4).fill(0) as number[]);
  const rhs = Array(4).fill(0) as number[];
  for (const sample of samples) {
    const time = sample.timestampMs - origin;
    const row = [Math.sin(2 * Math.PI * time / periodMs), Math.cos(2 * Math.PI * time / periodMs), 1, time];
    const weight = sample.weight ?? 1;
    for (let a = 0; a < 4; a += 1) {
      rhs[a]! += weight * row[a]! * sample.value;
      for (let b = 0; b < 4; b += 1) normal[a]![b]! += weight * row[a]! * row[b]!;
    }
  }
  const [sine, cosine, offset, trend] = solve(normal, rhs);
  let residual = 0; let weightTotal = 0;
  for (const sample of samples) {
    const time = sample.timestampMs - origin;
    const predicted = sine! * Math.sin(2 * Math.PI * time / periodMs) + cosine! * Math.cos(2 * Math.PI * time / periodMs) + offset! + trend! * time;
    const weight = sample.weight ?? 1;
    residual += weight * (sample.value - predicted) ** 2; weightTotal += weight;
  }
  return { amplitudeMm: Math.hypot(sine!, cosine!), residualRmsMm: Math.sqrt(residual / weightTotal), phaseRad: Math.atan2(cosine!, sine!), offsetMm: offset!, trendMmPerMs: trend! };
}

function solve(matrix: number[][], rhs: number[]): number[] {
  const augmented = matrix.map((row, index) => [...row, rhs[index]!]);
  for (let column = 0; column < 4; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 4; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) < 1e-10) throw new Error("Oscillation fit is degenerate");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let index = column; index <= 4; index += 1) augmented[column]![index]! /= divisor;
    for (let row = 0; row < 4; row += 1) if (row !== column) {
      const factor = augmented[row]![column]!;
      for (let index = column; index <= 4; index += 1) augmented[row]![index]! -= factor * augmented[column]![index]!;
    }
  }
  return augmented.map((row) => row[4]!);
}
