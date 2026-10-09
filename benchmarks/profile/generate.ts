export function generateProfileFixtures(seed = 42) {
  let state = seed >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
  return [-20, -10, -5, -2, 2, 5, 10, 20].flatMap((deltaMm) => ["base", "lower-body", "upper-body", "rim"].map((region) => ({
    id: `${region}-${deltaMm}`, region, deltaMm, noiseMm: Number(((random() - 0.5) * 0.2).toFixed(6)), seed,
  })));
}
