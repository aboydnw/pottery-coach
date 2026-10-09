# Pottery Coach V1 product specification

## Outcome

A novice can mount a supported phone beside a wheel, pass setup/calibration, state a cylinder or curated-template goal, converse hands-free, receive sparse evidence-backed outer-shape guidance, and review/delete the session.

## Journeys

1. **Setup:** data-flow notice → camera permission → framing/lighting guide → calibration → mic/provider consent → goal.
2. **Live:** persistent capture indicators; camera preview/target overlay; local observations; voice questions and barge-in; pause/resume/end; uncertainty surfaced without nagging.
3. **Reference:** choose curated template or local image/manual trace; confirm body outline; enter wet target or fired target plus explicit shrinkage; preview normalized target.
4. **Review:** duration, goal, height/profile graphs, confidence gaps, evidence-backed events, user-marked local moments, limitations, export/delete.

## Personas, scope, non-goals

Personas and supported/non-supported claims are normative from `01-product-scope-and-assumptions.md`. V1 supports only a single visible cylinder/body in prescribed side view. It is not a safety system and does not infer tactile/internal/material state.

## Functional acceptance

- Setup rejects clipped ROI, unsupported pose, bad marker, and inadequate contrast with one actionable correction.
- All numeric speech maps to a `readingId`, valid calibration, relevant confidence >=0.75, overall >=0.80, freshness <=750 ms for answers (<=500 ms proactive), and error p95 <=10 mm.
- Direct questions can return an explicit unmeasurable answer.
- Cloud loss preserves local preview/measurements/logging and offers reconnect.
- Background/orientation/track interruption pauses trust and requires reacquisition.
- User can interrupt speech, pause listening, end, and delete without voice.
- Default network trace contains no raw video/still image.
- Post-session summary labels missing/low-confidence periods and never fills gaps.

## Nonfunctional acceptance

Supported devices meet Gate 1/5 for 20 minutes; accessibility includes 44 CSS-pixel controls, visible focus, captions/transcript option, non-color status, reduced motion, and text alternatives; CSP and secrets tests pass; session operations are offline-safe except cloud voice.

## Release levels

`research`: desktop/synthetic fixtures. `controlled-prototype`: all gates except broad field diversity, instructor present. `field-prototype`: seven gates pass on listed devices/conditions. No production/medical/safety claim is implied.
