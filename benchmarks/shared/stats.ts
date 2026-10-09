export function quantile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length - 1) * fraction)]!;
}
export function ratio(numerator: number, denominator: number) { return denominator ? numerator / denominator : null; }
export function monotonicGrowth(values: number[]) {
  return values.length >= 4 && values.every((value, index) => index === 0 || value > values[index - 1]!);
}
