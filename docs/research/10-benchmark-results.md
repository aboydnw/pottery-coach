# Benchmark results and gate ledger

## Integrity note

No physical devices, paid API credentials, pottery footage, fiducial print, known objects, rotating rig, novice participants, or pottery instructors were available. Therefore Benchmarks 1, 2, 4, 5, 7 and the physical portion of 3/6 are **not run**. Documentation review is not substituted for empirical results. This is why the recommendation is “Prototype only.”

Per the 2026-10-09 scope decision, implementation may continue through the remaining plans before a consolidated physical phone test. This changes sequencing only; it does not mark any gate passed or expand supported-device claims.

| Benchmark | Status | Pre-registered pass condition | Harness/plan |
|---|---|---|---|
| 1 camera throughput | Desktop harness validated; physical gate not run | preview >=24 fps; vision >=10 fps; no monotonic memory growth/20 min | Plan 1 `benchmarks/camera` |
| 2 dimensions | Synthetic scenes run through `segmentVessel` + `extractDimensions`; physical locked set pending | median abs <=5 mm; p95 <=10 mm; bias <=5 mm; unsupported pose rejection >=95% | Plan 2 `benchmarks/dimensions` |
| 3 profile similarity | Seeded analytic profiles run through `compareProfiles` | analytic MAE within 0.5 mm; direction correct; >=70% regional coverage | Plan 3 `benchmarks/profile` |
| 4 wobble | 50 synthetic series run through period estimation, fit, classification and persistence; physical rig pending | significant precision >=90%; <=1 false/10 min; <=3 rev delay; >=90% recall at 10 mm; camera negatives >=95% suppressed | Plan 4 `benchmarks/wobble` |
| 5 voice latency | Not run: placeholder runner only; paid-provider runs pending | response p50 <=1.5 s; barge-in <=300 ms; local urgent <=500 ms; reconnect measured | Plan 5 `benchmarks/voice` |
| 6 restraint | 54-scenario deterministic mock corpus implemented; instructor review pending | zero invented/stale/low-confidence claims; zero cooldown duplicates | Plan 6 `benchmarks/coaching` |
| 7 end-to-end | Browser journeys implemented; phone/novice runs pending | >=80% unassisted completion in first 10 users; report CI/failures; uncertainty comprehension >=80% | Plans 8–9 |

## Integrated gate

Repeat Benchmark 1 with camera + mic + live provider. Pass only if measurement-rate reduction <20%, the 20-minute session completes without reload/thermal termination, and p95 frame age remains <=500 ms. Record battery delta and thermal state; no universal numeric battery limit is asserted before device baselines exist.

## Result schema

Every run writes JSONL with `benchmarkVersion`, git commit, fixture/session ID, UTC time, device/browser/OS, configuration hash, metric numerator/denominator, exclusions, unmeasurable count, raw summary statistics, and artifact checksums. Summaries include per-condition values and bootstrap intervals. Gate decisions are signed Markdown records; missing results fail closed.

## Camera harness development result — 2026-10-09

The 60-second Chromium fake-camera `camera-worker` run produced [`benchmarks/camera/artifacts/2026-10-09T17-36-27.959Z-camera-worker.jsonl`](../../benchmarks/camera/artifacts/2026-10-09T17-36-27.959Z-camera-worker.jsonl). It recorded preview 20 fps, processed 9 fps, p95 frame age 8.9 ms, and zero dropped frames. Preview and processed rates are below the provisional targets. This run validates artifact production only: it is short, uses fake media, has no mobile thermal behavior, and cannot pass or narrow Gate 1. Gate 1 remains closed pending the physical runs in `docs/device-test-protocol.md`.

## Synthetic harness results — 2026-10-14

Until this date the dimension, segmentation, wobble, voice and integrated runners wrote numbers generated from fixed formulas (for example, wobble predictions were copied from the expected labels), so their artifacts measured nothing. Those artifacts were removed. The dimension, segmentation, wobble and profile runners now execute the product code on rendered synthetic scenes; voice and integrated print a placeholder notice and write no artifact until a provider or device harness exists.

| Benchmark | Result on synthetic scenes | Gates failing |
|---|---|---|
| 2 dimensions | height median abs 0.7 mm, p95 1.2 mm, bias +0.6 mm | unsupported-pose rejection 0%: tilted views are measured instead of rejected |
| Segmentation | width median abs 1 mm, p95 1 mm; occluded scenes flagged unmeasurable 100% | none |
| 3 profile | max regional error 0.1 mm | none |
| 4 wobble | recall at 10 mm 100%; precision 40%; 9 false alerts per 10 min; camera-motion suppression 40% | precision, false alerts, delay, camera suppression |

These are synthetic results and cannot pass any gate. They show two real gaps: the worker never estimates camera pose or motion (`cameraMotionRmsMm` is always null and `estimateCameraTransform` is unused), so neither pose rejection nor camera-motion suppression can work yet.

## Angled-camera implementation — 2026-10-23

The prototype now detects a complete wheel-rim ellipse, estimates a constrained weak-perspective view pose from the known wheel diameter, rejects incomplete or unsupported views, and carries that pose into metric extraction. The setup overlay reacquires the camera view every session while remembering the diameter. Synthetic tests cover the geometry and rejection rules, but no physical known-object or phone run has validated a supported angle range or real-world accuracy. Gate 2 remains closed.

The 2026-10-09 camera harness result above reported zero dropped frames because the dropped-frame counter could never increase; it now counts frames the worker refused.
