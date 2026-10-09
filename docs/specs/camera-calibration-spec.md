# Camera calibration specification

```ts
type CameraSettings = { deviceIdHash: string; width: number; height: number; frameRate: number; facingMode: string | null; zoom: number | null };
type Point2 = { x: number; y: number };
type CalibrationQuality = { tagCount: number; reprojectionErrorPx95: number; scaleVariationFraction: number; estimatedErrorMm95: number; poseYawDeg: number | null; posePitchDeg: number | null; blurScore: number; contrastScore: number };
type CalibrationResult = { id: string; createdAtMs: number; status: "accepted"|"manual-review"|"rejected"; homographyImageToMm: [number,number,number,number,number,number,number,number,number]; wheelBaseline: [Point2,Point2]; wheelCenterlineXmm: number; roiImage: {x:number;y:number;width:number;height:number}; markerPlaneOffsetToleranceMm: number; quality: CalibrationQuality; reasons: string[]; provenance: "automatic"|"manual-assisted" };
```

The printed board defines millimetre coordinates, 100 mm verification line, unique tag IDs, vertical axis, baseline, print-at-100% warning, and revision/checksum. Setup detects >=3 distributed tags, estimates/refines homography, measures reprojection/scale variation, estimates pose where possible, checks ROI/focus/contrast, and cross-checks wheel geometry.

Initial acceptance: reprojection p95 <=1.5 px, scale variation <=2%, |yaw|/|pitch| <=8°, predicted error p95 <=10 mm, ROI complete, board revision supported. A manual correction never overrides predicted error, clipping, or print-scale failure. Any detected board/camera motion invalidates calibration and all later readings until reacquired.

Calibration uncertainty contains empirical segmentation error, reprojection error, residual lens distortion, and maximum supported plane-offset bias. The UI displays the supported marker placement/distance band; the physical benchmark sets final bounds.
