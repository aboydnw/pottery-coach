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
