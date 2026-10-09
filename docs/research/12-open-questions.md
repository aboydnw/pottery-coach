# Open questions and closure tests

These are not implementation blockers for Plan 1; each has an owner and a closure test.

| Question | Owner/plan | Closure test |
|---|---|---|
| Which exact iPhone/Android versions meet 20-minute targets? | Plan 1 | Device traces and signed Gate 1 record |
| Can a browser fiducial detector reliably find the printed board? | Plan 2 | >=99% acquisition in supported setup matrix |
| What plane offset is tolerable? | Plan 2 | Error-by-offset curve; set physical marker tolerance |
| Does controlled segmentation survive wet dark/light clays? | Plan 2 | >=90% valid non-hand frames across condition matrix |
| Is 2–5 mm visible oscillation measurable? | Plan 4 | Labeled clip precision/recall and amplitude MAE |
| What wheel rotation proxy works without a visible wheel mark? | Plan 4 | Compare autocorrelation, FFT, and boundary periodicity |
| Which provider/model meets latency and cost? | Plan 5 | Same scripts/network/device; p50/p95 and provider usage |
| Are realtime transcripts sufficient for the summary? | Plan 5/7 | Transcript completeness audit; local command log fallback |
| What cues are correct at each throwing phase? | Plan 6/9 | Instructor signs cue matrix; contested cues removed |
| What shrinkage default is safe? | Plan 3 | No universal default; user/clay-profile input or 0% with warning |
| Do users understand “visually centered”? | Plan 9 | >=80% correctly explain limitation after session |
| Are bystanders commonly captured? | Plan 9 | Field privacy observation; reposition/crop guidance |
| Are arbitrary reference images worth V1 scope? | Post-V1 | Curated evaluation shows >=90% correct body extraction and perspective rejection |
