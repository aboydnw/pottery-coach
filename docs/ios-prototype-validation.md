# iPhone prototype validation plan

This is a native feasibility milestone, not a release gate decision. The existing [device protocol](device-test-protocol.md), [calibration contract](specs/camera-calibration-spec.md), and [privacy notice](privacy-notice.md) remain authoritative. Simulator and synthetic checks do not establish real camera, clay, marker, thermal, or dimensional performance.

## Scope and boundaries

The first target exercises native camera capture and local recognition of the existing printed board. A stable marker observation is not an accepted metric calibration: it does not validate print scale, camera intrinsics, off-plane vessel geometry, or physical error. Do not show numerical vessel dimensions or claim marker-free operation. Full clay segmentation, page-removal/background learning, coaching, voice, account synchronization, and session migration remain later milestones.

Camera use begins only after an explicit action. Stop must release capture; interruption or leaving the foreground must clear prior marker evidence and require a fresh capture session. No raw images, video, or audio are uploaded. This prototype does not request microphone or photo-library access, record media, or add credentials. Real-camera testing requires a tester to deliberately start the camera.

## First physical-device run

Record the app commit, exact iPhone model, OS, camera selected, print revision, lighting, and phone mounting. Use the existing board at 100% scale and verify its 100 mm line with a ruler. Keep it flat and centered on the wheel axle. Do not infer a correct print scale from tag recognition alone.

1. Check initial launch makes no camera request until Start. Decline access, retry through the documented OS settings path, then restart. Repeated taps must not create duplicate capture sessions.
2. Confirm a real preview and local detection of the board's expected tag family and IDs. Test partial boards, rotated pages, glare, blur, unrelated markers, and temporary occlusion. Missing detections must clear or age out evidence rather than display it as current.
3. Move the page or phone. Previously stable evidence must become unavailable until new stable observations are collected. Never substitute tracked screen positions for verified fresh observations.
4. Stop, background/foreground, interrupt the camera with another app, rotate the device, and restart. No old stable state should survive. Verify the camera indicator turns off after Stop or backgrounding.
5. Run a 20-minute session and compare with the browser on the same phone and scene. Record observed capture/detection rates, detection latency, frame age where available, memory, battery, and visible thermal warnings. Record missing diagnostics as unavailable, not zero. Keep failures and unmeasurable runs.
6. Inspect network activity and local storage: no camera frames or recordings should leave the device or be retained by this prototype.

This one-device experiment can guide architecture but cannot establish mobile support. Broader validation must use the existing protocol's repeated independent setups, supported-device matrix, known forms, and negative/occlusion scenes. The native-migration note's 5 Hz investigation threshold is not the device protocol's 10 Hz processing and 24 fps preview acceptance requirement.

## Next implementation gate

After capture and detection behavior is verified, port or share the existing homography, pose, quality, and temporal-calibration contracts with parity fixtures. Preserve unsupported-perspective rejection and the explicit page-removal step before empty-wheel learning. Only then connect the segmentation baseline and measurement pipeline. A small tag-fit residual is not evidence of accurate vessel height above the board plane.

Cloud voice is a separate later step: retain explicit microphone consent, the named provider disclosure, interruption handling, and local operation when voice fails. Do not assume native packaging permits background/locked-screen camera processing. No signing, TestFlight distribution, App Store submission, or production deployment is part of this change.
