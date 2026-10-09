# Target profile specification

```ts
type TargetSource = "curated-template"|"reference-image"|"manual-trace";
type TargetProfile = { id:string; name:string; revision:number; normalizedRadiusByHeight:Array<{heightRatio:number;radiusToHeightRatio:number}>; intendedWetHeightMm:number; shrinkageFraction:number|null; source:TargetSource; confidence:number; exclusions:string[] };
type ProfileRegion = "base"|"lower-body"|"upper-body"|"rim";
type RegionalProfileError = { region:ProfileRegion; signedMedianRadiusErrorMm:number|null; meanAbsoluteRadiusErrorMm:number|null; coverage:number; confidence:number };
type ProfileComparison = { id:string; timestampMs:number; readingId:string; targetId:string; meanAbsoluteRadiusErrorMm:number|null; normalizedSilhouetteIoU:number|null; regions:RegionalProfileError[]; confidence:MeasurementConfidence };
```

Templates contain 101 monotonic height-ratio samples and validation metadata. Scale to explicit wet dimensions. If the user starts from fired dimensions, compute `wet=fired/(1-shrinkageFraction)` and display the assumption; no clay-independent shrinkage default exists.

Compare mutually valid rows, confidence-weighted. A region requires >=70% coverage. The overlay never interpolates a gap >5 consecutive samples. Coaching selects the highest-confidence persistent signed regional deviation, not merely the global score. Reference imports reject/route to manual trace under the conditions in research document 06.
