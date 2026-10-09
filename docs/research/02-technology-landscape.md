# Technology landscape

Research date: 2026-10-08. Browser facts must be feature-tested at runtime and rechecked before dependency upgrades.

## Application stacks

| Option | Strength | Cost/risk | Decision |
|---|---|---|---|
| React + Vite | Small static deployment, direct worker/WASM control, mature component/testing model | Client state must be designed explicitly | Selected |
| Next.js | Convenient server routes/deployment | SSR/RSC do not help the vision loop; tighter runtime coupling | Reject for client; a serverless function is sufficient |
| Framework-free TypeScript | Lowest runtime abstraction | Reinvents accessible stateful UI/test composition | Reject |
| PWA | Installability, manifest, possible wake-lock benefits | iOS lifecycle/background limits remain | Progressive enhancement |

Pinned starting ranges for implementation: Node `>=24 <25`, pnpm `>=10 <11`, TypeScript `~7.0.2`, React/ReactDOM `~19.3.0`, Vite `~7.1.3`, Vitest `~5.0.3`, Playwright `~1.58.0`. Exact lockfile versions are committed in Plan 1 and upgraded only with device smoke tests.

## Vision runtimes

- Browser-native Canvas/ImageData first; an audited custom WASM fiducial module only when required.
- OpenCV documents web builds and standard threshold/contour algorithms, but its common JS artifact cannot be assumed to expose ArUco; exact exports are tested ([OpenCV.js setup](https://docs.opencv.org/4.x/d4/da1/tutorial_js_setup.html), [issue 23723](https://github.com/opencv/opencv/issues/23723)).
- AprilTag 3 recommends `tagStandard41h12`, but browser ports are third-party; pin source/wasm checksums and benchmark before selection ([official repository](https://github.com/AprilRobotics/apriltag)).
- MediaPipe Tasks Vision is a viable browser/WASM optional hand mask; its published segmenters are not clay-specific and synchronous calls should be isolated from UI ([Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)).
- WebGPU is opportunistic only; WASM/Canvas/WebGL are baseline fallbacks.

## Deployment

Static assets deploy to a CDN with HTTPS. `/api/realtime/session` is a same-origin serverless endpoint holding the provider key. Content Security Policy restricts media/connect endpoints. No application database is required until multi-device persistence is explicitly added; IndexedDB is the prototype system of record.

## Source list

React/npm and tool versions: [React](https://www.npmjs.com/package/react), [TypeScript](https://www.npmjs.com/package/typescript), [Vite](https://www.npmjs.com/package/vite), [Vitest](https://www.npmjs.com/package/vitest) (accessed 2026-10-08). Browser sources appear in the capability matrix.
