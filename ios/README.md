# iPhone camera and marker prototype

This is a standalone SwiftUI/AVFoundation development app, separate from the web product. It exercises the native camera and the existing board-v1 marker family. It is **not** a native port of the complete coach and does not produce calibrated millimetres or vessel measurements.

## Implemented

- Rear-camera preview after an explicit Start action, landscape-right orientation.
- Local `tagStandard41h12` detection using pinned AprilRobotics C sources. No network packages are resolved when building.
- All four IDs 0–3 must be present, decoded without correction and stable for at least five observations spanning 500 ms before green outlines appear. This deliberately stricter **detector-only** gate is not the web calibration acceptance gate. It neither validates board geometry nor checks print scale, and cannot establish physical accuracy.
- Grayscale processing downscaled to at most 640 pixels wide, sampled at at most 10 Hz. A serial processing queue and `alwaysDiscardsLateVideoFrames` prevent a frame-processing backlog.
- Explicit stop, permission denial/no-camera recovery, background/interruption teardown, and a two-second stale-frame watchdog. Restart requires a new Start action and reacquires marker stability. No background or locked-screen capture. The screen stays awake only while capture runs; stop, interruption and background restore the previous idle-timer setting.
- Optional focus/exposure lock, where supported. Changing controls clears marker stability.
- Processed rate, detector time, current frame age (capture session synchronization clock), and late-frame count. These are live diagnostics, not device-performance claims or p95 benchmarks.

## Privacy and scope

No microphone permission, recording, image export, account login, analytics, cloud voice, or app networking is implemented. Camera samples and downscaled grayscale buffers stay in memory and are discarded. Session data is not retained. The privacy manifest declares elapsed-time measurement; no timing values leave the app.

Marker lock is not metric calibration. The next stage must port and verify the board transform/pose, uncertainty and rejection rules before offering numerical readings. Page-removal confirmation, empty-wheel background learning, clay segmentation, persistent session history and voice remain outside this spike. The web release flags and evidence gates are untouched.

Use the same [board-v1 SVG](../public/calibration/board-v1.svg), printed at 100%, and verify the reference line with a ruler. The app cannot verify the physical print size. Tests generated from the detector family are synthetic and do not establish compatibility with real printed pages, physical precision or real-phone performance.

## Build and test

Requires Xcode with an iOS SDK and Swift 5.9 or later. The app targets iOS 17 or later. From the repository root:

```sh
# Optional when the machine's selected developer directory is Command Line Tools:
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

swift test --package-path ios/PotteryCameraCore
xcodebuild -project ios/PotteryCamera.xcodeproj -scheme PotteryCamera \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

The package tests run native C detections against generated synthetic markers and the literal tag glyphs in the shipped board-v1 SVG, plus negative and stability/reset cases. The SVG parity test excludes decorative text/lines and is not a physical-page test. The simulator can show and exercise UI and no-camera behavior; it cannot validate the rear camera, focus/exposure controls, wheel accuracy or thermals. For a device build, open `ios/PotteryCamera.xcodeproj` in Xcode and choose an existing authorized development team. This repository does not create signing credentials or provisioning profiles and no paid membership is assumed.

Before claiming phone support, complete the [native validation checklist](../docs/ios-prototype-validation.md) and the existing physical device and calibration protocols. Keep failures, rejected readings and unsupported cases visible.

## Detector provenance

- Official upstream: <https://github.com/AprilRobotics/apriltag>
- Pinned commit: `b7c0ebe9aa20f82ec7a828579004f9e706bfecd9`
- Retrieved: 2026-11-10
- Family: `tagStandard41h12`, matching `src/calibration/boardV1.ts`
- License: BSD-2-Clause, preserved in [APRILTAG-LICENSE.md](PotteryCameraCore/APRILTAG-LICENSE.md) and upstream source headers.
- Unmodified upstream files: `apriltag.c`, `apriltag.h`, `apriltag_math.h`, `apriltag_quad_thresh.c`, `tagStandard41h12.c`, `tagStandard41h12.h`, and the `common/` C/header support files.
- `PotteryCameraCore/UPSTREAM-SHA256SUMS` records the vendored upstream file hashes. `pottery_detector.c` and `include/pottery_detector.h` are this project's thin wrapper, not upstream files.

The browser's existing WASM detector remains unchanged and has its own pinned provenance. No assertion of binary parity between the two detector versions is made.
