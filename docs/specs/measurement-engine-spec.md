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

Clay masks come through a versioned `ClaySegmenter` provider. `background-v1` is the deterministic baseline. A learned local provider may replace it only with an immutable checksum manifest and held-out evidence meeting IoU >=.85, median boundary error <=6 mm, p95 <=12.7 mm, no-clay false positives <=2%, occlusion-suppression recall >=95%, and slow-device p95 latency <150 ms.

For angled wheel-head calibration, the worker receives the serializable `WheelViewPose` and builds a local measurement transform. It resolves height along the projected vessel axis, estimates radius from paired silhouette boundaries under the rotational-symmetry assumption, and increases uncertainty away from the calibrated wheel plane. It emits millimetres directly, so the legacy constant scale is never applied a second time. Unsupported points are null rather than silently measured with frame-wide pixels. Shape-only sessions retain normalized pixel evidence.

`overall` is conservatively bounded by the minimum critical component and temporal factor. Null values are normal. Last-known values live only in `lastReliableTimestampMs`; they are not emitted as current. Quantitative-answer eligibility: overall >=.80, relevant components >=.75, freshness <=750 ms, estimated error <=10 mm, >=5 reliable samples/last second. Proactive eligibility tightens overall to .82 and freshness to 500 ms.
