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
