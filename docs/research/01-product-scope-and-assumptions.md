# Product scope and assumptions

## Product promise

Help a beginner monitor the *visible outer silhouette* of one wheel-thrown straight cylinder from one calibrated side view while keeping wet hands off the phone. The coach reports confidence and freshness, stays quiet when evidence is weak, and distinguishes observation from advice.

## Personas

- **Beginning thrower:** knows basic wheel operation, wants sparse reminders and dimensional feedback.
- **Instructor/test facilitator:** authors/reviews rules and labels sessions; does not expect automated replacement.
- **Research operator:** configures fixtures, exports diagnostic records, and manages footage consent.

## Supported V1

Rear camera; rigid side mount; controlled backdrop/light; printable marker; single clay body; cylinder up to 350 mm tall; spoken goal; height, outer widths/profile, visible asymmetry, target comparison, and on-demand visible-oscillation status; curated templates; local continuity during voice loss; post-session event/measurement summary.

## Explicit non-goals

Internal centering, wall/floor thickness, pressure, moisture, clay-body inference, advanced forms, arbitrary viewpoints, handle/decorative extraction, autonomous safety supervision, universal accessibility, collapse prediction, and automatic assessment of instructor-quality technique.

## Assumptions and falsifiers

| Assumption | Falsifier | Response |
|---|---|---|
| Web-first can sustain preview + 10 Hz vision + voice | Any supported device misses 10 Hz or grows memory >10% after warm-up in two repeated 20-min runs | Lower ROI/resolution; if still failing, trigger native assessment |
| Planar calibration is adequate | p95 error >10 mm under prescribed pose | Narrow pose/plane tolerance or remove millimetre speech |
| Geometry works under controlled conditions | Segmentation valid-frame rate <90% without hands | Improve environment controls before adding ML |
| Visible wobble can be specific | Precision <90% or >1 false warning/10 min | Keep on-demand descriptive status only or remove feature |
| Voice is useful | p50 response >1.5 s or distraction median >2/5 | Prefer local earcons/short canned cues; make conversation optional |

## Degraded modes

- Calibration invalid: preview only; no quantitative statements.
- Occluded/stale: say “I can’t see it clearly right now” only in response to a question; suppress proactive cues.
- Voice disconnected: local measurements, overlay, event log, and short local urgent earcon/canned cue continue.
- Storage unavailable: live session works; summary is ephemeral; disclose before start.
- Wake lock denied/backgrounded: pause measurement, record interruption, require explicit resume and freshness reset.
- Wobble unavailable: answer with inability, never substitute asymmetry for oscillation.

## Product acceptance

The prototype is accepted only when a novice can complete setup, calibration, goal entry, one cylinder session, spoken dimension query, barge-in, and summary discovery; quantitative speech is traceable to a fresh timestamped reading; deletion removes local/cloud session artifacts; and the seven gates in the executive summary have recorded decisions.
