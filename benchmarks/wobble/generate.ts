export function generateWobbleFixtures(seed = 42) {
  return [0, 2, 5, 10, 20].flatMap((amplitudeMm) => [400, 700, 1000, 1500, 2500].flatMap((periodMs) =>
    [false, true].map((cameraMotion) => ({ id: `${amplitudeMm}-${periodMs}-${cameraMotion}`, amplitudeMm, periodMs,
      cameraMotion, seed, occlusionFraction: amplitudeMm === 5 ? 0.35 : 0.1 }))));
}
