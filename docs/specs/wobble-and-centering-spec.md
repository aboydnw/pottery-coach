# Wobble and visible-centering specification

```ts
type WobbleClassification = "visually-stable"|"minor-visible-oscillation"|"significant-visible-oscillation"|"rim-variation"|"shape-varies-with-rotation"|"source-ambiguous"|"unmeasurable";
type TemporalContourSample = { timestampMs:number; frameId:number; centersMm:Array<number|null>; leftMm:Array<number|null>; rightMm:Array<number|null>; rimCenterMm:number|null; rimHeightMm:number|null; cameraTransformConfidence:number; occluded:boolean; shapeChangeRate:number };
type WobbleReading = { id:string; timestampMs:number; amplitudeMm:number|null; periodMs:number|null; classification:WobbleClassification; confidence:number; evidenceWindowMs:number; observedRevolutions:number; validSampleFraction:number; cameraMotionRmsMm:number|null; lastReliableTimestampMs:number|null; reasons:string[]; sourceFrameIds:number[] };
```

The estimator uses irregular timestamps, robustly camera-corrects, detrends, estimates a 0.3–3 s candidate period with autocorrelation and spectral confirmation, robustly fits sinusoidal center/boundary terms, and classifies signal coherence by height band. It requires >=3 rotations, >=70% valid samples, amplitude >3× residual noise, confidence >=.85, and two agreeing overlapping windows for proactive `significant` output.

Suppression: hand/tool overlap, shape-change rate above benchmark threshold, invalid calibration, background transform confidence <.8, camera residual >benchmark limit, period disagreement >15%, or ambiguous wheel signal. `visually-stable` means below the validated external detection limit and is phrased “visually centered from this view”; it never asserts internal/perfect centering. If Gate 3 fails, proactive events are disabled and the tool returns `unmeasurable` or descriptive on-demand evidence.
