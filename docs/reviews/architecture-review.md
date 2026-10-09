# Architecture review

## Adversarial checks and resolutions

| Challenge | Finding | Resolution |
|---|---|---|
| Cloud model in realtime path? | It must not own perception, urgent timing, or facts | Local worker/rules/arbiter; cloud phrases tool-backed facts |
| Quantitative traceability? | Initial generic tool proposal lacked immutable reading link | Every reading/cue/tool result carries IDs, timestamp, calibration, confidence/freshness |
| Independent degradation? | Voice/provider could otherwise block session | Separate flags/states for numeric vision, wobble, voice, storage; local continuation |
| Processing clocks explicit? | Equal-rate loop would queue work | Preview >=24, vision 10 adaptive, UI <=10, coach 2/event, snapshot off |
| Safari portability? | TrackProcessor is not baseline | Canvas/ImageBitmap path first; feature-selected fast path |
| Provider lock-in? | Realtime event dialects differ | Narrow `RealtimeCoachTransport`; contract/mock tests; no lowest-common-denominator facts |
| Calibration plane risk? | Homography cannot fix off-plane clay | Plane tolerance/error bound and physical offset matrix |
| Data minimization? | Session replay/continuous images would violate intent | No analytics replay on capture; no raw media by default |

## Decision

Architecture is coherent enough for gated implementation. Gate 2 and Gate 5 are structural stop points. No realtime-critical or quantitative decision is delegated to the LLM.
