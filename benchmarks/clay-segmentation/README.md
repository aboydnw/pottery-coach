# Clay segmentation benchmark

This benchmark validates explicit local dataset exports before they are used for offline training or held-out evaluation.

1. Capture and review examples in the real app.
2. Export the local JSONL file deliberately; the app never uploads it.
3. Group training and evaluation by recording session so adjacent video frames cannot leak across the split.
4. Train a compact binary segmentation model offline.
5. Compare its masks with `background-v1` on the frozen evaluation sessions.
6. Record model version, dataset version, SHA-256, input size, mask threshold, accuracy metrics, and slow-device latency in a `clay-model-v1` manifest.
7. Promote the manifest only when `validateClayModelManifest` accepts every gate.

This repository does not contain promoted learned weights yet. Synthetic fixtures test the contracts; they are not evidence of real-world clay accuracy.

`summarizeClaySegmentation` rejects incomplete evaluation sets: foreground truth, measured clay-boundary errors, no-clay scenes, and scenes with more than 30% occlusion are all required. Empty-scene boundary values cannot supply clay-boundary evidence, and no-clay scenes cannot supply occlusion-suppression evidence. Masks must be nonempty and matching; numeric measurements must be finite, nonnegative, and valid fractions where applicable. Missing coverage is an evaluation error, never a passing default. `passesClayModelGate` also rejects invalid metric values before applying the unchanged thresholds. These checks establish minimum metric coverage, not dataset adequacy or physical validation.

## Local annotation preflight

Run `pnpm benchmark:clay-segmentation evaluation.jsonl` on an explicitly exported local file. Add a second path, `training.jsonl`, to reject shared session groups or example IDs between training and evaluation. The command neither uploads data nor trains a model. Missing input and invalid exports exit unsuccessfully.

Preflight rejects empty or mismatched manifests, duplicate IDs, missing session groups, unreviewed/unusable examples, absent reviewed clay masks, foreground in no-clay truth, invalid mask runs/dimensions, missing rights declarations, and remote image URLs. A no-clay verdict supplies empty truth even when the automatic mask has false positives; it need not contain a corrected mask. Remove unusable examples deliberately and update the manifest count before running preflight. Do not change review verdicts merely to pass validation.

Passing is **annotation-structure validation only**. It does not decode image bytes, verify source licenses or attribution, detect duplicate images with different IDs, establish calibrated geometry, measure model accuracy, or authorize training. Licensed-external candidates still require provenance/attribution review and actual human-reviewed masks. Keep related photographic sequences together even if their filenames differ. External photographs without marker calibration cannot establish millimetre accuracy.

Before real scoring, freeze dataset identity, independent session splits, inclusion/exclusion criteria, and annotation review. Use the [calibration fixture protocol](../../docs/calibration-fixture-protocol.md) and [device test protocol](../../docs/device-test-protocol.md) for measured forms, independent setups, occlusion and camera movement. Retain failures and unmeasurable results. Synthetic contract tests are not field evidence and do not open release gates.
