import type { ProfileComparison } from "./types";

export function GoalProgress({ comparison, heightProgress }: { comparison: ProfileComparison; heightProgress: number }) {
  const eligible = comparison.confidence.overall >= 0.8 && comparison.confidence.freshnessMs <= 750;
  const deviations = comparison.regions
    .filter((region) => region.coverage >= 0.7 && region.confidence >= 0.75 && region.signedMedianRadiusErrorMm !== null)
    .sort((left, right) => Math.abs(right.signedMedianRadiusErrorMm!) - Math.abs(left.signedMedianRadiusErrorMm!));
  const top = deviations[0];
  const milestone = heightProgress >= 1 ? 100 : heightProgress >= 0.95 ? 95 : heightProgress >= 0.8 ? 80 : null;
  return (
    <section aria-labelledby="progress-title">
      <h2 id="progress-title">Goal progress</h2>
      {milestone && <p>{milestone}% height milestone reached.</p>}
      {!eligible || !top ? (
        <p>Regional comparison is not reliable enough for a coaching claim yet.</p>
      ) : (
        <p>{top.region.replace("-", " ")} is about {Math.abs(top.signedMedianRadiusErrorMm!).toFixed(0)} mm too {top.signedMedianRadiusErrorMm! > 0 ? "wide" : "narrow"}.</p>
      )}
    </section>
  );
}
