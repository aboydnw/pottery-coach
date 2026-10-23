# Angled-Camera Wheel Calibration Design

**Status:** Approved 2026-10-23

## Purpose

Pottery Coach must support the camera placement that is practical beside a working wheel: above and to the side of the wheel head, aimed approximately through the wheel center. The camera is not assumed to be horizontal. Setup should feel like a check-deposit or card-scanning flow: the app finds the relevant geometry, shows the user what it found, and asks for intervention only when confidence is insufficient.

The normal setup asks for the wheel-head or bat diameter once and remembers that physical property. Every session detects the wheel again because the camera may have moved. The product must not ask users for focal length, sensor size, lens distortion, camera height, or other camera parameters.

## Supported setup and explicit assumptions

The first release supports a constrained capture envelope:

- One circular wheel head or circular bat is fully visible, including its left, right, front, and rear rim.
- The camera is rigidly mounted above and beside the wheel, aimed approximately through the wheel center.
- The vessel is centered approximately on the wheel and its outer form is treated as rotationally symmetric for radius estimation.
- The user supplies the wheel-head or bat diameter from a preset or custom value once per saved setup.
- The wheel occupies at least 25% of the image width and leaves a sufficient working region above it for the vessel.
- The exact supported pitch, yaw, roll, distance, and ellipse-coverage thresholds remain configuration constants that synthetic tests exercise and physical validation may narrow. They are not public accuracy claims until the physical gate passes.

The release does not claim to recover literal camera height, reconstruct arbitrary asymmetric geometry, measure internal wall thickness, support arbitrary camera placement, or provide validated real-world millimetre accuracy before the physical benchmark passes.

## User experience

### First setup

1. The user selects a common wheel/bat diameter or enters a custom diameter.
2. The live camera opens with a wheel-shaped guide.
3. The app detects candidate ellipses for fully visible circular rims.
4. A stable, high-confidence candidate receives an overlay showing the detected rim, center, projected wheel axes, rotational axis, and supported vessel region.
5. The app automatically accepts the result after it remains stable for 750 ms. A visible **Adjust** control remains available during the countdown and on the resulting setup summary.
6. If confidence is insufficient, the app does not accept the result. It gives one actionable instruction and exposes manual correction.

### Returning setup

The saved diameter is preselected. The app still redetects the ellipse and view pose. A prior camera calibration is never silently reused because the phone or mount may have moved.

### Manual fallback

Manual adjustment edits the ellipse rather than two vertical edge lines. Pointer and keyboard controls can move the center, change horizontal and vertical radii, and rotate the ellipse. Nested candidates remain selectable so a user can step past a splash pan to the bat or wheel head.

Manual editing changes detection provenance to `manual-assisted`; it does not bypass hard pose, framing, or uncertainty gates. If an edited ellipse remains unsupported, metric measurement stays unavailable and the app offers shape-only mode or repositioning.

### Guidance copy

The app presents one highest-priority correction at a time. Stable reason codes map to plain guidance:

- `WHEEL_RIM_INCOMPLETE`: “Move the phone until the whole wheel rim is visible.”
- `WHEEL_TOO_SMALL`: “Move the phone closer so the wheel fills more of the guide.”
- `WORKING_REGION_CLIPPED`: “Tilt or move the phone so there is more room above the wheel.”
- `VIEW_TOO_SHALLOW`: “Raise the phone so more of the wheel’s top is visible.”
- `VIEW_TOO_STEEP`: “Lower or move the phone back so the pot’s side remains visible.”
- `VIEW_OFF_AXIS`: “Aim the phone more directly through the center of the wheel.”
- `ELLIPSE_UNSTABLE`: “Hold the phone still while the wheel outline locks.”
- `ELLIPSE_AMBIGUOUS`: “Choose the outline that matches your wheel head or bat.”

## Geometry model

### Wheel ellipse

The detector produces ranked candidates:

```ts
type WheelEllipse = {
  centerX: number;
  centerY: number;
  radiusMajor: number;
  radiusMinor: number;
  rotationRad: number;
  fitResidualPx95: number;
  visibleArcFraction: number;
  confidence: number;
};
```

Radii are positive, `radiusMajor >= radiusMinor`, rotation identifies the major-axis direction in image coordinates, and confidence is in `[0, 1]`.

### View pose

The pose derived from a known physical diameter and a detected ellipse is:

```ts
type WheelViewPose = {
  wheelCenterImage: Point2;
  majorAxisImage: Point2;
  minorAxisImage: Point2;
  projectedVerticalImage: Point2;
  downwardAngleRad: number;
  wheelPlaneMmPerMajorPixel: number;
  supportedRegionImage: { x: number; y: number; width: number; height: number };
  estimatedErrorMm95: number;
  confidence: number;
  reasons: string[];
};
```

The initial estimator uses an orthographic/weak-perspective circle-to-ellipse model. With ellipse semi-axes `a` and `b`, its inclination estimate is `acos(clamp(b / a, 0, 1))`. The known wheel diameter establishes scale along the major axis. Ellipse rotation establishes the projected wheel axes. The projected vessel vertical is perpendicular to the wheel plane’s projected minor-axis direction and oriented toward the supported working region.

This value is called `downwardAngleRad` or a view-pose estimate, never camera height. The browser does not expose sufficiently reliable camera intrinsics to claim a unique physical camera position.

### Coordinate transform

Metric extraction consumes a calibration transform rather than a constant `unitsPerPixel`:

```ts
type MeasurementTransform = {
  imageToWheel(point: Point2): { radialMm: number; verticalMm: number };
  radiusAt(left: Point2, right: Point2, verticalMm: number): number;
  estimatedErrorMm95At(point: Point2): number;
};
```

The first implementation provides `WheelPoseTransform`, which:

- resolves displacement along the projected vessel axis into vertical displacement using the pose estimate;
- converts the two silhouette boundaries into an estimated radius under the rotational-symmetry assumption;
- applies position-dependent weak-perspective compensation rather than a single frame-wide scale;
- increases estimated error with distance from the calibrated wheel plane and with ellipse-fit uncertainty;
- refuses points outside the supported region.

Shape-only extraction remains available without this transform and continues to use normalized proportions. Metric extraction must not fall back silently to the old constant-scale calculation.

## Detection architecture

`detectWheelHead` becomes a compatibility entry point over a focused ellipse detector. The detector:

1. Converts the camera image to a downscaled grayscale representation.
2. Produces rim-edge points in the lower portion of the frame.
3. Groups compatible edge points into closed ellipse candidates.
4. Fits ellipses robustly while rejecting isolated clutter.
5. Scores residual error, visible-arc coverage, size, aspect ratio, working-region clearance, and temporal stability.
6. Returns ranked nested candidates for splash pans, bats, and wheel heads.

The implementation must be deterministic and dependency-free. It may use direct least-squares ellipse fitting plus robust inlier refinement; it must not add a learned model or large computer-vision runtime in this milestone.

Temporal stability is evaluated outside the single-frame detector by comparing candidates across frames. Auto-accept requires a candidate with confidence at least `0.80`, no hard rejection reasons, and stable center/radii/rotation for 750 ms. These thresholds are internal starting points subject to benchmark revision.

## Calibration data and persistence

`CalibrationResult` gains the selected ellipse and derived view pose. Wheel-head calibration no longer creates a diagonal constant-scale homography and presents it as perspective-correct metric calibration. Existing stored calibration records migrate safely:

- stored wheel diameter remains reusable;
- legacy edge-only calibrations are readable for session history;
- a new live metric session requires fresh ellipse acquisition;
- board calibration remains supported as the precision fallback.

Setup persistence stores a named wheel/bat setup containing diameter and unit preference. It does not store a trusted live pose across sessions.

## Measurement pipeline

The measurement worker receives a serializable pose description and constructs its local `WheelPoseTransform`. It rectifies measurement coordinates logically during extraction; the displayed camera preview remains unwarped.

For each reliable silhouette row, extraction uses the intersection of that row’s boundaries with the wheel-centered coordinate system. Height is measured from the detected wheel plane along the projected vertical axis. Profile samples remain 64 fixed height ratios. Width, rim, base, centerline offset, lean, and asymmetry are calculated in corrected coordinates.

Calibration uncertainty feeds the existing confidence model. When pose confidence is below the metric threshold, current millimetre values are null. Shape-only values can still be computed in normalized units. Voice and proactive cues continue to require their existing confidence and freshness gates.

## Failure and safety behavior

- No ellipse or incomplete rim: remain in setup and provide positioning guidance.
- Multiple similarly plausible ellipses: show candidates and require selection.
- Camera movement after calibration: invalidate metric trust and reacquire the ellipse.
- Pose outside the supported envelope: reject metric calibration; never allow manual confirmation to override it.
- Missing remembered diameter: request the diameter before metric calibration.
- Transform singularity or point outside the supported region: emit null for the affected metric and record a stable reason.
- Existing board calibration: continue to work independently and remain available when higher precision is needed.

## Testing and evidence

### Unit tests

Generate synthetic circles projected as ellipses across downward angle, rotation, scale, offset, noise, blur, partial occlusion, nested rims, and clutter. Verify ellipse parameter recovery, candidate ranking, pose estimates, stable reason codes, and deterministic results.

Project known stepped and curved rotational profiles through the same weak-perspective model. Feed rendered masks into extraction and verify recovered height and widths inside the supported envelope. Verify rejection or increasing uncertainty outside it.

### Component and browser tests

Cover first-time diameter selection, remembered diameter, overlay rendering, 750 ms stable auto-accept, cancellation through **Adjust**, nested candidate selection, keyboard-accessible ellipse correction, actionable low-confidence guidance, and shape-only degradation.

### Benchmarks

Extend synthetic dimension and segmentation fixtures with angle-stratified cases and unsupported-pose negatives. Report dimension error by angle, ellipse-fit error, unsupported-pose rejection, unmeasurable rate, and processing time. Synthetic results validate implementation only.

The physical gate uses known stepped forms at multiple camera heights, distances, yaw values, and downward angles on real phones. Until that gate passes, documentation must describe angled-camera measurement as experimental and must not claim a supported angle range or real-world accuracy.

## Delivery boundary

This milestone includes ellipse detection, overlay/manual correction, view-pose estimation, transform-aware measurement, persistence of diameter, synthetic evaluation, and documentation. It does not include a learned model, data collection from YouTube, a vertical-marker workflow, literal camera-height recovery, or physical validation. Those follow after the deterministic baseline is measurable.
