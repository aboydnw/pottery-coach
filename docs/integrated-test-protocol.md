# Integrated test protocol

Run a 20-minute camera-only control and two 20-minute voice-plus-vision sessions per supported phone. Exercise poor network, background/resume, and both orientations. Capture local diagnostics only; verify there are no image/video network bodies, frame-sized base64 or binary payloads, or raw audio/video in storage.

Pass only when processing-rate loss is below 20% versus control, p95 frame age is at most 500 ms, queues remain bounded, memory shows no monotonic growth, no reload or thermal termination occurs, and voice latency targets remain met. These physical runs are intentionally consolidated after Plans 2–9 implementation.
