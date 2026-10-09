# Technical risk register

Scale: probability/impact/detectability 1–5; RPN=P×I×D. 60+ critical, 30–59 high, 12–29 medium, <=11 low. Impact 5 or missing validation blocks release regardless of score.

| Risk | P/I/D; RPN | Mitigation | Fallback | Validation |
|---|---|---|---|---|
| A studio segmentation | 5/4/3;60 | guide, environment checks, backdrop, pan restriction, confidence | stronger model; null/manual target trace | locked studio corpus |
| B perspective error | 4/4/3;48 | planar board, pose rejection, error bound, plane tolerance | normalized-only speech | known-object matrix |
| C hand occlusion | 5/3/2;30 | reliable-row mask, anomaly/optional hand mask, freshness | abstain and report last reading age | annotated occlusion clips |
| D wobble vs shaping | 4/4/4;64 | >=3 revolutions, phase/change suppression, camera compensation | on-demand or remove | physical/synthetic negatives |
| E voice excess/latency | 4/4/3;48 | local urgent cues, priorities, cooldown, barge-in | text/local-only | scripted restraint + user tests |
| F browser performance | 4/4/3;48 | worker, ROI, adaptive 10→5 Hz, backpressure | reduced resolution/native trigger | 20-min integrated traces |
| G Safari interruption | 4/4/3;48 | visibility pause, wake lock, reconnect, stale reset | narrower support/native trigger | iPhone matrix |
| H harmful unsupported advice | 4/5/4;80 | fact tools, prohibited language, instructor rule approval | descriptive-only | adversarial transcripts |
| I no training data | 3/3/2;18 | geometry/rules V1 | omit learned phase/collapse | baseline evaluation |
| J API cost/network | 3/3/2;18 | usage meter, restrained output, local continuity | composed/local-only | scripted provider benchmark |
| Bystander audio | 4/5/3;60 | notice, indicators, pause/push-to-talk | local-only | field privacy audit |
| Provider retention mismatch | 3/5/3;45 | versioned manifest/config audit | block provider | pre-release policy test |
| Fiducial wet/moved/wrong scale | 3/4/2;24 | print ruler/checksum, board-motion invalidation | manual calibration/wider bound | abuse fixture set |

Each plan records inherent and residual scores. A mitigation is accepted only after its named validation produces an artifact linked from Benchmark Results.

## Current ownership and gate posture

Vision owns A–D and fiducial risks; performance owns F/G; trust and the two instructor reviewers own E/H; security/privacy own bystander and provider-retention risks; product owns J and study stop decisions. Automated mitigations are implemented, but residual scores remain unchanged until their physical or human validation artifact is signed. The release manifest therefore keeps numeric production mode, proactive wobble, cloud voice, and mobile support disabled.
