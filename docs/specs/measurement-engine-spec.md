# Measurement engine specification

```ts
type ConfidenceComponent = { score: number; reasons: string[] };
type MeasurementConfidence = { overall: number; calibration: ConfidenceComponent; segmentation: ConfidenceComponent; occlusion: ConfidenceComponent; temporalStability: ConfidenceComponent; freshnessMs: number; estimatedErrorMm95: number | null };
type ProfileSample = { heightRatio: number; radiusMm: number | null; confidence: number };
type DimensionReading = { id: string; timestampMs: number; sourceFrameId: number; calibrationId: string; heightMm: number | null; maximumWidthMm: number | null; rimWidthMm: number | null; baseWidthMm: number | null; centerlineOffsetMm: number | null; profile: ProfileSample[]; visibleAsymmetryMm: number | null; confidence: MeasurementConfidence };
type StableDimensionReading = DimensionReading & { windowStartMs: number; contributingFrameCount: number; lastReliableTimestampMs: number | null };
type MeasurementWorkerRequest = { type:"configure"; calibration:CalibrationResult } | { type:"frame"; frameId:number; capturedAtMs:number; bitmap:ImageBitmap } | { type:"reset"; reason:string };
type MeasurementWorkerEvent = { type:"reading"; instantaneous:DimensionReading; stable:StableDimensionReading|null } | { type:"diagnostic"; frameId:number; processingMs:number; droppedBefore:number } | { type:"invalidated"; reason:string };
```

The worker keeps one pending frame maximum; a newer frame replaces an unprocessed pending frame. It rectifies the ROI, segments against the calibrated background, selects the wheel-connected plausible contour, generates a row reliability mask, extracts 64 samples, calculates instantaneous values, and then applies temporal filters. Buffers are reused and `ImageBitmap.close()` is called.

`overall` is conservatively bounded by the minimum critical component and temporal factor. Null values are normal. Last-known values live only in `lastReliableTimestampMs`; they are not emitted as current. Quantitative-answer eligibility: overall >=.80, relevant components >=.75, freshness <=750 ms, estimated error <=10 mm, >=5 reliable samples/last second. Proactive eligibility tightens overall to .82 and freshness to 500 ms.
