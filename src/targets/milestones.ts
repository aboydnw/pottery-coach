export class MilestoneTracker {
  private reached = new Set<number>();
  constructor(private thresholds: number[] = [0.8, 0.95, 1], private hysteresis = 0.02) {}
  update(progress: number) {
    for (const threshold of this.thresholds) if (progress < threshold - this.hysteresis) this.reached.delete(threshold);
    const emitted: number[] = [];
    for (const threshold of this.thresholds) {
      if (progress >= threshold && !this.reached.has(threshold)) { this.reached.add(threshold); emitted.push(Math.round(threshold * 100)); }
    }
    return emitted;
  }
}
