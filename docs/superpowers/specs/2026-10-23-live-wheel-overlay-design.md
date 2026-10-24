# Live Wheel Overlay Design

## Goal

Make wheel-head calibration use the camera's current view throughout setup, keep the camera visible, and remove captions from the default live-session surface.

## User experience

Starting wheel-head calibration by voice or touch closes the settings sheet and enters a live calibration mode over the existing full-screen camera. The app samples the current video several times per second and draws the latest detected wheel rim as a yellow SVG ellipse over that same video. It never renders a copied camera frame.

The compact status progresses from “Finding wheel…” to “Hold steady…” and then “Wheel found.” A supported outline that remains geometrically stable for about one second is accepted automatically. Moving the phone changes the outline and resets the stability timer. Detection stops after acceptance.

When multiple candidates are present, compact “Inner outline” and “Outer outline” controls select which candidate to follow. “Try again” clears the current stability and resumes automatic detection. “Adjust manually” freezes automatic candidate replacement while preserving the live camera beneath draggable/range-based geometry controls; confirming or retrying exits manual adjustment.

Settings and End Session stay available throughout calibration. Camera interruption, camera switching, retry, and a new calibration request clear all candidate and stability state so no previous frame or outline can be reused.

## Captions

Captions are hidden by default and do not render over the live camera. Settings contains a “Show captions” toggle for accessibility. When enabled, captions appear in a compact bounded area that does not cover the calibration controls or most of the camera. Voice connection and failure notices remain independent of caption visibility.

## Architecture

`useLiveWheelDetection` owns the calibration loop: request lifecycle, periodic current-frame capture, detection, full-resolution coordinate mapping, candidate selection, geometric stability, automatic acceptance, interruption cleanup, and errors. It exposes the current ellipse and candidates without exposing a captured image.

`WheelLiveOverlay` draws the ellipse, center, row, and supported measurement region using the active video's intrinsic coordinate space. It contains status and compact candidate/retry/manual controls, but no canvas or still image.

`LiveSession` connects voice and touch to the same start, adjust, switch, confirm, retry, and cancel operations. Accepted calibration continues through the existing `wheelEllipseCalibration`, quality gates, stored scale format, and measurement pipeline.

## Data flow

1. Voice or touch starts live wheel detection with the confirmed diameter.
2. The loop captures the current `HTMLVideoElement` frame at each interval.
3. Detection maps the downsampled candidate geometry back to the video's intrinsic pixels.
4. The overlay renders that geometry over the live video.
5. Stable supported geometry auto-confirms after approximately one second.
6. Confirmation derives and applies the existing wheel calibration using current video dimensions, then tears down the loop.

No `ImageData` is retained in React state after a detection pass.

## Error handling

- Before the camera has dimensions, the loop remains in “Finding wheel…” and retries.
- Weak, clipped, or unsupported detections update guidance but never auto-confirm.
- Detection exceptions pause the loop and expose “Try again.”
- Camera interruption or lens switching clears stability and candidates.
- Manual adjustment suspends automatic outline replacement until confirm or retry.

## Testing

Unit and component tests must prove that successive samples capture successive current frames, changing geometry resets stability, stable supported geometry auto-confirms, new requests never reuse old candidates, manual mode prevents replacement, and cleanup stops capture. Live-session tests must prove voice and touch share the same flow, the frozen still/modal is absent, captions are hidden by default and available from Settings, and camera controls remain reachable. Browser tests cover touch calibration, voice calibration, captions, camera switching, and mobile layout.

## Non-goals

This work does not change the wheel detector, calibration mathematics, saved calibration schema, voice provider, Cloudflare Access, or downstream measurement pipeline.
