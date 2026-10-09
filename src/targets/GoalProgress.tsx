import { useEffect, useRef } from "react";
import type { ProfileComparison } from "./types";
import { MilestoneTracker } from "./milestones";

export function GoalProgress({ comparison, heightProgress, milestones = [0.8, 0.95, 1], onMilestone }:
  { comparison: ProfileComparison; heightProgress: number; milestones?: number[]; onMilestone?: (percent: number, evidenceId: string) => void }) {
  const tracker = useRef<MilestoneTracker | null>(null);
  if (!tracker.current) tracker.current = new MilestoneTracker(milestones);
  useEffect(() => {
    if (comparison.confidence.overall >= 0.8 && comparison.confidence.freshnessMs <= 750)
      tracker.current!.update(heightProgress).forEach((percent) => onMilestone?.(percent, comparison.readingId));
  }, [comparison, heightProgress, onMilestone]);
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
