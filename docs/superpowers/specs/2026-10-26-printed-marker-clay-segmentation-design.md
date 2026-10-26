# Printed Marker Calibration and Clay Segmentation Design

**Date:** 2026-10-26
**Status:** Approved

## Purpose

Pottery Coach needs physical scale and camera pose so it can estimate vessel dimensions. Detecting the wheel head is only an indirect way to obtain that calibration and has proven unreliable in cluttered studios. The required setup path will therefore use a printable fiducial board designed for machine vision. Automatic wheel-head detection may remain as an optional convenience, but it will no longer gate quantitative measurement.

After calibration, the primary vision problem is clay segmentation: identifying the visible clay body while rejecting hands, tools, clothing, splash pans, bats, and background objects. A lightweight local segmentation model will eventually supply that mask. Deterministic geometry remains responsible for turning the mask into measurements and withholding unsafe results.

## Product decisions

- The browser application is the initial platform. The contracts must remain portable to a future iPhone application.
- The calibration page is placed flat on the wheel head and centered over the wheel axis.
- The user enters the wheel-head diameter once. It is remembered and used as an independent plausibility check, not as the primary scale reference.
- Camera frames and model inference remain on-device. Nothing uploads automatically.
- Version one targets height and maximum-width error at or below 12.7 mm (one half inch) at the 95th percentile under supported conditions.
- Spoken and displayed dimensions use approximate language and no false decimal precision.
- Unsupported, occluded, stale, or low-confidence measurements are withheld rather than guessed.

## Chosen approach

Use a staged hybrid:

1. A multi-tag printed board establishes metric scale, wheel center, wheel plane, projected vertical axis, supported measurement region, and error estimate.
2. A segmentation provider produces a per-pixel clay probability mask inside the supported region.
3. Deterministic cleanup, connectivity, occlusion, symmetry, and temporal checks turn that probability mask into reliable geometry.
4. The calibrated measurement engine converts accepted geometry into millimetres.

The current background-difference segmenter remains as a baseline and local fallback. It is not treated as a trained model. A learned model is promoted only after it outperforms that baseline on a held-out corpus and passes device performance checks.

## Scope and staged delivery

### Milestone A: printed-marker calibration

The first deployable milestone makes the printed board the default calibration path. It includes the print asset, printing and placement instructions, saved wheel diameter, live marker acquisition, stability checks, camera-lock monitoring, plain-language recovery guidance, and a manual non-metric fallback.

### Milestone B: segmentation evidence pipeline

The second milestone adds explicit local capture and export of calibration-aligned examples, a versioned annotation format, a fixed evaluation split, baseline metrics, and a provider contract suitable for either the current deterministic segmenter or a learned model.

### Milestone C: learned clay model

Training occurs offline after the evidence corpus exists. The initial candidate is a compact binary semantic-segmentation network with a 256×256 or 320×320 input. Architecture selection is based on held-out accuracy, browser latency, memory, and portability rather than a predetermined framework. The exported artifact must be immutable, checksummed, versioned, and usable without network access.

Milestone C cannot honestly manufacture useful weights before labeled real-world examples exist. The implementation may integrate and test the model runtime and contract with a deterministic fixture model, but production promotion requires the data and accuracy gates below.

## Calibration experience

### Printable page

The existing A5 landscape `board-v1` is extended into the supported product asset. It contains:

- four high-contrast AprilTags with unique IDs;
- a center target aligned to the page's known coordinate origin;
- radial alignment guides for centering over the wheel axis;
- a 100 mm ruler line;
- board revision and checksum;
- “Print at 100% — do not fit to page” guidance;
- a short placement sequence and a warning not to move the phone after calibration.

The browser offers a direct Print calibration page action and a downloadable SVG. The print stylesheet preserves physical dimensions. The user must confirm with a ruler that the 100 mm line is correct.

### Setup flow

1. Ask for wheel-head diameter if no remembered value exists. Accept 150–500 mm and display common inch equivalents.
2. Explain printing, ruler verification, flat placement, and center-target alignment.
3. Open the camera and detect at least three spatially distributed board tags.
4. Require stable geometry across at least five accepted observations spanning at least 500 ms.
5. Reject cropped regions, poor print scale, excessive blur, excessive perspective, inconsistent wheel diameter, or an unsupported board revision.
6. Show the calculated wheel center, vertical axis, and supported clay envelope.
7. Ask the user to remove the page without touching the phone, then learn the empty-wheel background.
8. Lock calibration for the session and monitor camera movement.

The remembered wheel diameter is compared with the board-derived expected wheel geometry. A disagreement greater than 10% requests that the user recheck page centering, print scale, and the entered diameter. It never silently rescales the calibration.

### Camera movement

After the page is removed, the application stores a small, privacy-local set of visual anchor descriptors outside the wheel's working region. Translation above 6 processed pixels, rotation above 1.5 degrees, scale change above 2%, or persistent low anchor confidence invalidates quantitative readings. Thresholds must later be converted to physical error through device testing.

The UI says that the phone moved and provides one action: Recalibrate. Previously emitted readings remain historical but are not presented as current.

### Fallback behavior

If the marker cannot be detected, the user can retry with targeted guidance or continue in shape-only coaching mode. Manual wheel-head alignment may help frame the scene but cannot produce trusted inch measurements. Automatic wheel-head detection is optional and never overrides an accepted board calibration.

## Calibration contracts

`CalibrationResult` remains the authoritative session record. Board calibration adds explicit wheel and camera fields rather than overloading wheel-head fields:

```ts
type BoardPose = {
  boardRevision: "board-v1";
  wheelCenterImage: Point2;
  projectedVerticalImage: Point2;
  supportedRegionImage: { x: number; y: number; width: number; height: number };
  wheelDiameterMm: number;
  boardToWheelCenterOffsetMm: Point2;
  estimatedErrorMm95: number;
};

type CalibrationLock = {
  calibrationId: string;
  referenceFrameSize: { width: number; height: number };
  anchors: CameraAnchor[];
  status: "locked" | "moved" | "lost";
};
```

All geometry and confidence logic is pure TypeScript and fixture-testable outside React. Tag detection and frame processing remain isolated behind adapters and workers.

## Clay segmentation

### Provider boundary

```ts
type ClaySegmentationInput = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  calibratedRoi: { x: number; y: number; width: number; height: number };
};

type ClaySegmentationOutput = {
  width: number;
  height: number;
  probability: Float32Array;
  modelVersion: string;
  processingMs: number;
};

interface ClaySegmenter {
  readonly version: string;
  segment(input: ClaySegmentationInput): Promise<ClaySegmentationOutput>;
  dispose(): void;
}
```

The worker owns one provider instance and keeps at most one pending frame. The provider may be the deterministic background baseline or a learned local model. Downstream measurement code consumes the same normalized probability mask regardless of provider.

### Post-processing and safety checks

The output mask is cropped to the calibrated supported region and then:

- thresholded using the model version's validated operating point;
- opened and closed to remove specks and fill small reflective gaps;
- restricted to a plausible component connected to the wheel-center band;
- checked for frame clipping, floating components, implausible branching, and sudden area changes;
- marked unreliable on rows intersecting hands or tools;
- stabilized across time without filling long or ambiguous gaps.

The algorithm assumes that the vessel is centered and approximately rotationally symmetric. Width at each reliable height comes from paired silhouette boundaries around the calibrated centerline. Unsupported rows return `null`.

## Dataset and annotation

An opt-in testing control records one calibration-aligned example at a time. Before export, the tester confirms one of:

- clay outline correct;
- clay outline corrected;
- no clay present;
- unusable because of occlusion or framing.

Each example contains the downscaled frame, binary corrected mask when applicable, calibration identifier and geometry, entered wheel diameter, capture dimensions, segmentation provider/model version, automatic mask, condition tags, and consent/license metadata. It excludes voice, account identifiers, and precise timestamps. Export is a local ZIP/JSON package initiated by the user; individual examples and the whole local corpus can be deleted.

External stills or video frames require an explicit compatible license or documented permission. They may improve diversity but do not replace production-camera examples.

The corpus is split by recording session, not by individual frame, to prevent nearly identical neighboring frames from appearing in both training and evaluation sets. The evaluation split is immutable once used for a model comparison.

## Training and model promotion

Training runs outside the product. Transfer learning starts from a compact mobile segmentation backbone. Augmentation may vary brightness, contrast, blur, compression, crop, and modest perspective, but must not create physically impossible silhouettes.

No model is promoted solely on training loss. It must beat the deterministic baseline on the held-out set and satisfy all of:

- clay-mask intersection-over-union of at least 0.85 overall;
- median boundary error at or below 6 mm;
- 95th-percentile boundary error at or below 12.7 mm;
- no-clay false-positive rate at or below 2%;
- at least 95% recall for suppressing measurements when more than 30% of the relevant silhouette is occluded;
- 95th-percentile inference plus post-processing latency below 150 ms on the slowest supported browser device;
- no sustained UI interruption attributable to inference.

These are initial release gates, not permanent claims. Results are recorded by dataset version, model checksum, browser, and device.

## Measurement and coaching

The calibrated geometry and accepted mask produce approximate height, maximum width, rim width, base width, sampled profile, centerline offset, and visible asymmetry. Quantitative speech requires fresh, stable readings and an estimated error at or below 12.7 mm. The coach uses phrases such as “about eight inches,” never unsupported decimal precision.

When confidence is insufficient, the coach explains the recoverable cause—hands blocking the form, phone moved, form outside the supported region, or outline uncertain—and continues qualitative coaching where possible.

## Error handling

- Wrong print scale: block metric calibration and ask the user to reprint at 100%.
- Too few tags: identify that the full page must be visible and better lit.
- Page not centered or flat: show the center/flatness correction; do not compensate silently.
- Diameter mismatch: ask the user to verify entry, print scale, and placement.
- Camera moved: invalidate current measurements immediately and require recalibration.
- Model unavailable or corrupt: fall back to the deterministic provider and mark learned segmentation unavailable.
- Model disagreement or low confidence: suppress the affected dimensions.
- Hands or tools obscure the outline: retain historical readings but emit no current value.

## Testing strategy

- Unit tests cover board geometry, print dimensions, diameter validation, stability aggregation, camera-lock thresholds, provider contracts, mask cleanup, and measurement eligibility.
- Component tests cover the full setup flow, remembered diameter, print instructions, recovery guidance, shape-only fallback, model fallback, and deletion/export controls.
- Golden image fixtures cover valid boards, blur, glare, crop, wrong scale, poor centering, and camera movement.
- Segmentation fixtures cover clay colors, wet highlights, bats, hands, tools, clothing, empty wheels, and non-clay round objects.
- End-to-end tests use a deterministic fake camera and fake model provider.
- Physical validation uses independently measured stepped forms across supported devices, camera positions, lighting, clay colors, and wheel sizes.

## Out of scope

- Training continuously or automatically on the user's live camera feed.
- Uploading images without explicit export and consent.
- Exact 3D reconstruction of arbitrary asymmetric sculpture.
- Reliable dimensions while the phone is handheld or moving.
- Promising quarter-inch accuracy before physical evidence supports it.
- Making automatic wheel-head recognition a prerequisite.

## Rollback and migration

The marker workflow is additive to stored calibration data and versioned by board revision. Existing wheel-head sessions remain readable. If marker calibration fails in the field, users retain shape-only coaching and the previous manual framing tools. If the learned model fails its gate or runtime loading fails, the deterministic provider remains available and quantitative output follows the same confidence rules.
