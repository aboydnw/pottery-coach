# Camera device test protocol

Gate 1 remains closed until all required physical runs are linked from `docs/research/10-benchmark-results.md`.

## Printed marker and clay measurement gate

For each supported phone/browser combination, run five independent setups with the page printed at 100%, flat and centered on the wheel axle. Include at least two wheel diameters, three lighting conditions, dry and wet clay, a bat, hands, and a tool crossing the silhouette. Compare height and maximum width against independently measured stepped forms. Record median, p95, bias, rejection rate, false measurements during >30% occlusion, calibration time, inference latency, and camera-movement invalidation. Metric release requires p95 dimensional error <=12.7 mm and the clay-model gates documented in `benchmarks/clay-segmentation/README.md`.

## Setup

1. Use a recent iPhone/Safari, recent Android/Chrome, or desktop Chrome. Record exact hardware, OS, browser version, delivered camera settings, and build identifier.
2. Mount the device rigidly in landscape, keep it connected to normal power, disable unrelated apps, and use the same diffuse lighting and high-contrast scene for both modes.
3. Open the HTTPS build. Confirm no permission prompt appears before selecting **Start camera** and that no raw image/video requests appear in the network log.

## Runs

For each device, run two 20-minute `camera-only` sessions and two 20-minute `camera-worker` sessions. Download JSONL diagnostics after every run. Do not discard failed or interrupted runs; record the reason and retain the artifact.

Record preview, acquired, processed, and rendered rates independently; p50/p95 frame age; dropped frames; delivered resolution/frame rate; memory when exposed; battery start/end when exposed; visible OS thermal warnings; reloads; track interruptions; and orientation changes.

## Decision

A device is supported only when every required run sustains preview >=24 fps and worker processing >=10 fps, shows no monotonic memory growth, and completes without reload or thermal termination. A reviewer checks permission teardown, queue depth <=1, raw artifacts, and exclusions. Fail closed or explicitly narrow support; never infer mobile support from the desktop fake-camera run.
