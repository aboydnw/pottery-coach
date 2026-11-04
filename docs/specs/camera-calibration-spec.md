# Camera calibration specification

```ts
type CameraSettings = { deviceIdHash: string; width: number; height: number; frameRate: number; facingMode: string | null; zoom: number | null };
type Point2 = { x: number; y: number };
type CalibrationQuality = { tagCount: number; reprojectionErrorPx95: number; scaleVariationFraction: number; estimatedErrorMm95: number; poseYawDeg: number | null; posePitchDeg: number | null; blurScore: number; contrastScore: number };
type CalibrationResult = { id: string; createdAtMs: number; status: "accepted"|"manual-review"|"rejected"; homographyImageToMm: [number,number,number,number,number,number,number,number,number]; wheelBaseline: [Point2,Point2]; wheelCenterlineXmm: number; roiImage: {x:number;y:number;width:number;height:number}; markerPlaneOffsetToleranceMm: number; quality: CalibrationQuality; reasons: string[]; provenance: "automatic"|"manual-assisted" };
type WheelEllipse = { centerX:number; centerY:number; radiusMajor:number; radiusMinor:number; rotationRad:number; fitResidualPx95:number; visibleArcFraction:number; confidence:number };
type WheelViewPose = { wheelCenterImage:Point2; majorAxisImage:Point2; minorAxisImage:Point2; projectedVerticalImage:Point2; downwardAngleRad:number; wheelPlaneMmPerMajorPixel:number; supportedRegionImage:{x:number;y:number;width:number;height:number}; estimatedErrorMm95:number; confidence:number; reasons:string[] };
```

The printed board is the primary metric setup. It lies flat on the wheel head with its center target aligned to the wheel axle. It defines millimetre coordinates, a 100 mm verification line, unique tag IDs, alignment guides, print-at-100% warning, and revision/checksum. Setup detects >=3 distributed tags, estimates/refines homography, measures reprojection/scale variation, checks ROI/focus/contrast, and accepts only five stable observations spanning >=500 ms. The remembered wheel diameter is checked for a plausible 150–500 mm range; if the optional rim detector independently observes a rim, disagreement above 10% is a hard failure.

Initial acceptance: reprojection p95 <=1.5 px, predicted error p95 <=10 mm, ROI complete, board revision supported, and a supported camera pose. A manual correction never overrides predicted error, clipping, or print-scale failure. Any detected board/camera motion invalidates calibration and all later readings until reacquired.

Flat-page results explicitly carry `boardPlacement: "wheel-plane"`. Perspective naturally changes scale across that horizontal page, so the legacy upright-board spatial scale-variation limit of 2% and near-frontal yaw/pitch limit of 8° do not apply to it. Those gates remain unchanged for legacy upright-board results. The flat-page pose uses principal axes of the homography's local Jacobian at the wheel center, so rotating the paper does not rotate the inferred vessel axis or alter scale. A projective horizon crossing the page is rejected, as are unsupported tilt, camera roll, and insufficient room above the wheel. The five-observation temporal scale-stability limit remains 2%.

This pose remains a local weak-perspective approximation, not calibrated camera-intrinsic recovery. A small board-fit residual does not establish off-plane vessel accuracy. The existing 2% spatial variation limit therefore remains a **metric-model eligibility limit**: a valid plane with greater variation is located successfully, but explicitly falls back to shape-only operation with no session scale. Its transform also refuses height and width values as defense in depth. Supporting numerical vessel measurements in those views requires a validated perspective model, not simply removing the old gate or substituting an invented error bound. Physical error and device gates remain open and unchanged.

After confirmation, processing stops until the potter explicitly confirms page removal. Only then is the empty-wheel background learned again; the page-containing background and its readings are discarded.

Calibration uncertainty contains empirical segmentation error, reprojection error, residual lens distortion, and maximum supported plane-offset bias. The UI displays the supported marker placement/distance band; the physical benchmark sets final bounds.

The optional wheel-head fallback assumes a camera above and beside the wheel, aimed approximately through its centre. It requires the full circular rim and derives a weak-perspective pose from a deterministic ellipse plus the remembered diameter. It is not literal camera-height recovery and never overrides an accepted printed-board calibration.

Metric radius estimation assumes an approximately rotationally symmetric outer form. No physical angle range or real-world accuracy is claimed until known stepped forms demonstrate <=12.7 mm p95 error under the device protocol.
