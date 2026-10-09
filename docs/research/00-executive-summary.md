# Executive summary

## Recommendation: Prototype only

The concept is technically plausible, but none of the physical feasibility gates has been executed in this workspace. Current browser and API documentation supports camera/microphone capture, worker-based processing, WebRTC speech-to-speech, function calling, and local storage. That is enough to justify a gated prototype, not enough to promise accurate dimensions or proactive wobble coaching.

As of 2026-10-09, Plans 1–9 have a working responsive web implementation, deterministic benchmark harnesses, and automated desktop/mobile-emulation journeys. Numeric production mode, proactive wobble, cloud voice, and mobile support fail closed in the unsigned release manifest. Synthetic/demo success is not a physical gate pass.

V1 is deliberately narrow: a mounted rear camera, prescribed landscape side view, printed planar fiducial beside the vessel plane, contrasting backdrop, good lighting, one straight-cylinder exercise, curated rotational templates, local geometric measurements, and conservative speech. Arbitrary reference photos, learned phase recognition, hand-technique judgment, collapse prediction, wall/floor thickness, internal centering, and proactive wobble advice are excluded until their gates pass.

## Selected architecture

- React 19 + Vite 7 + TypeScript 7 PWA; static client plus a small serverless token/session endpoint.
- `getUserMedia` rear-camera preview. Portable video-to-canvas acquisition is mandatory; `MediaStreamTrackProcessor` is an optional capability-selected fast path because MDN marks it limited and context-inconsistent.
- Dedicated worker at 10 Hz target; preview at >=24 fps; UI at <=10 Hz; coach observations at 2 Hz; still snapshots opt-in/on-demand only.
- Hybrid printed 100 mm fiducial plus manual two-point correction. Calibration establishes scale, ground line, vertical, centerline, pose acceptability, and an uncertainty budget.
- Controlled-background LAB/HSV segmentation, morphology, largest compatible contour, row-wise left/right profile, temporal robust smoothing. A stronger model is a post-gate fallback, not a default dependency.
- Local deterministic events + finite state context + cooldown/suppression manager. The language model explains tool-returned facts; it never supplies numeric measurements from perception.
- OpenAI Realtime over browser WebRTC is the provisional voice default because official docs recommend WebRTC for browser clients and document image input and function calling. Provider choice remains behind `RealtimeCoachTransport` until latency, retention, and cost tests run.
- Raw video is neither uploaded nor retained by default. Session records retain measurements, confidence, events, tool calls, latencies, errors, user commands, selected local stills, and consent state. Research footage requires separate explicit opt-in.

## Effort estimate

| Subsystem | Engineer-weeks | Exit condition |
|---|---:|---|
| Foundation/camera | 1.5–2 | Camera gate on 3 target devices |
| Calibration/measurement | 3–4 | Median <=5 mm, p95 <=10 mm supported setup |
| Target profiles | 1.5–2 | Regional errors produce correct fixture coaching |
| Wobble research | 2–3 | >=90% precision and <=1 false warning/10 min, else reactive-only |
| Realtime voice | 2 | Mobile interruption/reconnect/latency gate |
| Coaching orchestration | 2 | Zero unsupported or low-confidence quantitative cues |
| Review/retention | 1.5 | Diagnosable and deletable sessions |
| Integration/field hardening | 3–5 | Integrated and instructor gates |
| **Total** | **16.5–22.5** | One engineer; parallel work can reduce calendar time |

## Cost estimate per 20-minute session

Budget **$0.15–$1.50 per session** until measured. This is a planning envelope, not a quoted price: realtime services are token/duration billed, silence/context policies change cost, and current model prices can change. Record provider-reported usage and calculate actual p50/p95 cost in Plan 5 before choosing a model. Local vision and static hosting are negligible at prototype scale; storage stays near zero without raw video.

## Physical setup and support

- Phone rigidly mounted in landscape, rear camera, lens approximately level with mid-vessel and perpendicular to wheel axis.
- Entire wheel head, 100 mm fiducial, and maximum 350 mm working height visible; fiducial within 30 mm of the vessel mid-plane.
- Matte contrasting backdrop, diffuse light, clean lens, vibration-isolated mount.
- Provisional support: current Safari on a recent iPhone, current Chrome on a recent Android, and current desktop Chrome for development. Exact minimum OS/device list is set only by Gate 1.

## Top remaining risks

1. Studio segmentation under hands, reflections, slip, and clutter.
2. Perspective/parallax makes millimetre claims misleading.
3. Wobble signals confound deliberate shaping and camera motion.
4. iOS thermal, backgrounding, audio routing, and memory behavior during 20-minute combined sessions.
5. Coaching correctness and timing have not been validated by an experienced pottery instructor.

## Gate status

| Gate | Status | Evidence required |
|---|---|---|
| Camera viability | Not run | 20-minute traces on iPhone, Android, desktop |
| Measurement viability | Not run | Known-object matrix with parallax/angle repeats |
| Wobble viability | Not run | Labeled synthetic and physical rotating clips |
| Conversation viability | Not run | Paid API credentials and mobile WebRTC trials |
| Integrated performance | Not run | Vision + audio thermal/memory/latency trace |
| Trustworthiness | Specified, not run | Adversarial scripted sessions with zero violations |
| Domain review | Not run | Signed instructor review of cues and terminology |

Continue with the consolidated protocols in `docs/integrated-test-protocol.md` and `research/field/protocol.md`. Do not expose proactive wobble coaching, arbitrary-photo targets, or confident phase advice unless their gates pass.

## Native-app triggers

Move to a native client if two supported iPhone models cannot sustain the integrated 20-minute target; Safari background/audio interruptions cause >5% session failure; camera controls required for repeatability are unavailable; thermal throttling reduces measurement below 5 Hz; or field users require background/locked-screen operation. A native shell is not justified merely for installation polish.
