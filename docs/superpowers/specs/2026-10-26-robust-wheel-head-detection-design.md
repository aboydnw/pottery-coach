# Robust Wheel-Head Detection Design

**Status:** Approved 2026-10-26

## Purpose

Replace the current filled-region heuristic, which can jump to unrelated objects, with a deterministic browser-side detector that recognizes a fully visible circular wheel head or bat under perspective. The experience should borrow the useful constraints of check-deposit capture: assess capture quality first, explain one corrective action at a time, lock only after sustained evidence, and preserve an explicit manual selection.

This milestone remains browser-first and dependency-free. Its geometry and scoring modules must remain independent of browser capture and rendering so they can be reused behind a future native iPhone camera pipeline.

## Product constraints

- A complete wheel-head or bat rim is required for automatic acceptance.
- Small local edge gaps from glare, clay residue, or markings are allowed, but every major circumference sector must contain supporting evidence.
- A partial or clipped rim may produce a tentative suggestion for manual adjustment, but it cannot auto-confirm.
- Detection runs locally; frames are not uploaded.
- No learned model or large computer-vision runtime is added in this milestone.
- The existing mobile sampling cadence and interaction responsiveness must be preserved.
- A manual confirmation remains subject to hard framing and pose checks.

## Chosen approach

Use a multi-threshold edge-and-arc detector followed by robust ellipse fitting and pottery-specific ranking. This is preferred over importing OpenCV.js because it avoids a large runtime and still requires the same domain scoring. A learned detector or segmenter remains a future optional candidate generator once representative labeled data exists; it must not replace geometric verification of the complete rim.

## Processing pipeline

### 1. Capture-quality assessment

Before proposing geometry, compute deterministic frame statistics over the wheel search region:

- luminance range and local contrast;
- gradient energy and a blur score;
- saturated bright-pixel fraction as a glare signal;
- search-region bounds and candidate clearance from the frame.

The detector returns structured capture-quality reasons rather than treating every failure as “not found.” The UI presents one highest-priority action such as holding still, reducing glare, moving closer, or moving back until the complete rim is visible.

### 2. Multi-threshold edge extraction

Normalize local grayscale contrast in the lower search region. Compute gradient magnitude and direction, then retain non-maximum-suppressed edge pixels at several deterministic thresholds. Multiple thresholds let the same pipeline find light rims on dark surroundings, dark rims on light surroundings, and lower-contrast bats without reducing the entire image to one foreground mask.

Suppress isolated texture and very short edge runs. Preserve the signed gradient and tangent direction so later stages can join pixels that plausibly belong to the same curved rim.

### 3. Arc construction

Trace neighboring edge pixels whose position, tangent direction, and curvature are compatible. Split at sharp turns and large gaps. Reject arc fragments that are too short, nearly straight, excessively jagged, or outside the allowed lower-frame region.

Each surviving arc records its points, angular span, contrast polarity, mean strength, bounding box, and endpoint tangent directions. Compatible arcs may be combined across small gaps, including mixed-contrast sections caused by changing background behind the wheel.

### 4. Robust ellipse proposals

Create ellipse hypotheses from individual long arcs and compatible arc groups. Fit normalized conics deterministically, convert only valid ellipse conics, and refine each candidate through a fixed number of residual-based inlier passes. The implementation must reject degenerate, non-finite, or implausibly eccentric fits.

For every fitted ellipse, sample its predicted circumference into sectors and search for nearby edge support with compatible gradient orientation. Record:

- robust fit residual;
- supported circumference fraction;
- longest unsupported sector;
- support distribution across front, rear, left, and right quadrants;
- mean edge strength and orientation agreement.

This circumference evidence, rather than the area inside the ellipse, establishes whether a complete rim is visible.

### 5. Pottery-specific ranking

Rank candidates using normalized features rather than connected-component area:

- circumference support and residual quality;
- plausible projected aspect ratio;
- expected minimum image size;
- position in the lower camera region;
- complete frame clearance;
- sufficient vessel workspace above the rear rim;
- temporal agreement with the current tracked ellipse;
- optional support from concentric nested rims.

Apply hard rejection before score ordering for clipping, missing quadrants, excessive unsupported arc, impossible geometry, and unsafe working-region placement. Deduplicate near-identical candidates and return a small outer-to-inner ranked set so splash pans, bats, and wheel heads remain selectable.

### 6. Temporal tracking and lock

Single-frame detection remains pure. The live hook owns tracking:

- match new candidates to the tracked ellipse by normalized center, radii, and rotation distance;
- search and score the tracked neighborhood before accepting an unrelated global candidate;
- require a candidate to meet the complete-rim and pose gates continuously for the existing lock interval;
- decay tracking confidence across misses instead of immediately jumping;
- require repeated evidence before switching to a different object.

Automatic acceptance occurs only after the same supported candidate remains stable for the full interval. An isolated high-scoring frame cannot move or confirm the outline.

## Manual adjustment contract

Entering manual adjustment pauses automatic candidate replacement. The user-edited ellipse becomes the authoritative session candidate and is stored synchronously in the live hook so voice and touch confirmation read the same geometry.

Manual confirmation does not fabricate detector evidence. It may establish which ellipse the user means, but automatic metadata and user provenance stay distinct. Hard checks still require:

- the edited ellipse to lie fully within the frame with required clearance;
- a plausible size and aspect ratio;
- sufficient workspace above the wheel;
- the full predicted circumference to be visible in the image.

After confirmation, the calibration passed to the session and agent is immutable unless the user explicitly recalibrates or camera interruption invalidates it. Live detection cannot silently replace it.

## Interfaces and separation

The implementation separates portable computation from browser integration:

```ts
type WheelCaptureQuality = {
  blurScore: number;
  contrastScore: number;
  glareFraction: number;
  reasons: WheelCaptureReason[];
};

type WheelEdgeMap = {
  width: number;
  height: number;
  points: WheelEdgePoint[];
  quality: WheelCaptureQuality;
};

type WheelEllipseEvidence = {
  fitResidualPx95: number;
  visibleArcFraction: number;
  longestMissingArcFraction: number;
  supportedSectors: Uint8Array;
  orientationAgreement: number;
};
```

Pure modules perform preprocessing, edge extraction, arc grouping, ellipse fitting, evidence measurement, and candidate scoring. `useLiveWheelDetection` performs scheduling and tracking. React components only render geometry and guidance. Camera pixel acquisition remains the replaceable platform boundary for a future iPhone app.

## Failure behavior

- Poor capture quality: do not fit aggressively; return the most useful capture instruction.
- No supported complete rim: remain in setup and show no confirmed outline.
- Plausible partial rim: show a tentative outline and framing guidance; never auto-accept.
- Multiple supported nested rims: rank them, show the leading candidate, and retain inner/outer selection.
- Unstable candidate: keep the current tracked outline tentative and reset the lock timer.
- Manual edit: pause detector replacement and validate the edited geometry before confirmation.
- Camera interruption or lens switch: invalidate the calibration and reacquire.

## Testing strategy

### Synthetic geometry

Build reusable deterministic render helpers for anti-aliased ellipse rims with configurable perspective, rotation, contrast polarity, thickness, blur, noise, glare, shadows, missing sectors, nested rims, and foreground clutter. Test parameter recovery, complete-rim evidence, rejection reasons, ranking, and determinism.

### Distractor regression cases

Add synthetic scenes containing face-like ovals, apron graphics, bowls, buckets, boxes, arms, and large filled regions. Assert that unsupported interior blobs do not outrank a genuine circumference and that no distractor auto-confirms without complete rim evidence in the valid region.

### Tracking and manual handoff

Use timed frame sequences to verify stable lock, short misses, repeated jump requirements, candidate switching, reset after interruption, and that manual geometry survives confirmation into calibration and the voice-agent tool path.

### Real-device fixtures and performance

Use opt-in local recordings or extracted non-identifying frames from representative phones to tune thresholds after the deterministic suite passes. Cover light and dark wheel heads, bats, residue, glare, shadows, and common studio clutter. Record processing time at the detector's downscaled resolution and preserve at least the current five-samples-per-second live cadence on the supported browser profile.

No real-world accuracy claim is made until physical device validation passes.

## Delivery boundary

This milestone includes capture-quality feedback, multi-threshold edge extraction, arc grouping, robust ellipse proposals, full-circumference verification, domain ranking, temporal tracking improvements, persistent manual calibration, tests, and tuning hooks. It does not include a trained model, a remote recognition service, OpenCV.js, native iPhone camera code, or automatic collection/upload of user frames.
