# Realtime voice and coaching

## Provider comparison

| Criterion | OpenAI Realtime | Gemini Live | Composed STT→LLM→TTS |
|---|---|---|---|
| Browser path | Official WebRTC; backend unified session or ephemeral secret | Official direct WebSocket + preview ephemeral token; partner WebRTC | App-built transports |
| Interruption | Server VAD, cancel/clear/truncate events | Automatic VAD; interrupted event; client clears audio | Must coordinate 3 queues |
| Tools/images | Function calls and still image input documented | Tools and multimodal input documented | Depends on selected model |
| Session | Official docs state up to 60 min | 15 min audio without compression; resumption/compression available | Provider-specific |
| Audit transcript | Optional input transcript is not measurement truth | Input/output transcription separately billed | Canonical STT easiest |
| Prototype choice | **Provisional default** | Price/retention benchmark alternate | Latency/degraded-mode fallback |

Sources: [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), [Gemini Live](https://ai.google.dev/gemini-api/docs/live-api), [capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [ZDR](https://ai.google.dev/gemini-api/docs/zdr) (accessed 2026-10-08).

OpenAI list pricing supports a $1.00/20-minute GPT-Live duration estimate at $0.05/min when that SKU is used; token-priced Realtime requires measured usage. Gemini list rates imply roughly $0.154 for 20 input minutes and 3 output minutes at $0.005/$0.018 per minute, before other/context charges. Product budgeting remains $0.15–$1.50 until scripted provider usage is measured.

## Orchestration

Observations are local and timestamped. Rules create candidate cues. A state machine supplies `ThrowingPhase`; user declaration outranks visual inference. Arbitration orders: urgent visible instability, direct question, goal milestone, correction suggestion, encouragement, review observation. Proactive cues require a source event, policy threshold, persistence, freshness, cooldown, and no suppression. The LLM receives approved cue facts or invokes read-only tools; it cannot write measurements.

Locally triggered urgent cues target <500 ms and use a short pre-approved recorded/local utterance. Questions target response start <1.5 s p50. Barge-in targets audio stop <300 ms. Cloud loss cannot stop local measurements.
