# Browser capability matrix

| Capability | iPhone Safari | Android Chrome | Required behavior |
|---|---|---|---|
| Camera/mic `getUserMedia` | Supported in secure context with permission/user action | Supported in secure context | One explicit start gesture; read delivered track settings |
| Rear-camera selection | `facingMode: environment` is a request | Same | Display camera switch when >1 input; never assume lens |
| Video frame callback | Feature detect | Feature detect | Timer/canvas fallback; timestamp every acquired frame |
| `MediaStreamTrackProcessor` | Not a baseline; no verified Apple commitment | Chrome documents insertable video processing | Optional fast path only |
| OffscreenCanvas + worker | WebKit documents worker/2D support since Safari 16.4 | Supported | Main-thread canvas fallback |
| AudioWorklet | WebKit since Safari 14.1 | Supported | Optional metering/local DSP only |
| WebRTC | Supported | Supported | Preferred cloud voice transport |
| IndexedDB | Supported | Supported | Quota/error/deletion tests; bounded writes |
| Wake Lock | Home-screen web apps documented in iOS/iPadOS 18.4; browser context varies | Supported | Feature detect and reacquire on visibility |
| Fullscreen | Do not depend on iPhone element fullscreen | Supported | In-page landscape UI |
| Background | iOS pages may suspend; frames become stale | Throttling expected | Hidden means interrupted; pause and resume/reconnect |
| WebGPU | Safari 26+, device dependent | Device/driver dependent | Optimization only |
| WebGL/WASM | Supported | Supported | Baseline accelerated fallback |

Sources: [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [TrackProcessor](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor), [Chrome insertable media](https://developer.chrome.com/docs/capabilities/web-apis/mediastreamtrack-insertable-media-processing), [Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [WebKit power/background](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/) (accessed 2026-10-08).

## Device acceptance matrix

Plan 1 records hardware model, OS/browser, requested/delivered constraints, preview/acquisition/processed/UI rates, frame-age p50/p95, dropped frames, memory proxy, battery delta, thermal warnings, audio on/off, visibility interruptions, orientation events, focus/exposure changes, and 20-minute completion. Support is granted to a device class only after two clean repeated integrated runs.

Automated coverage currently includes desktop Chromium and Pixel-class Chromium emulation at narrow width, 200% text, orientation changes, offline/background interruption, camera teardown, evidence-linked review/deletion, mock voice controls, and raw-media network boundaries. This validates responsive behavior only; iPhone Safari, Android hardware, VoiceOver, TalkBack, thermals, focus/exposure, and audio routing remain pending the consolidated physical matrix.
