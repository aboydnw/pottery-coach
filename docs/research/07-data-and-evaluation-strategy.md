# Data and evaluation strategy

## Principles

Geometry/rules work without training data. Evaluation uses development fixtures and a locked, participant/studio-disjoint corpus. Session/clip—not frame—is the statistical unit; report bootstrap 95% intervals, exclusions, and unmeasurable rate. Frame-random splits are prohibited.

## Corpora

- Calibration: matte measured silhouettes at 50/100/200/300 mm heights, 40–200 mm widths, stepped/curved shapes; offsets -30..30 mm; angles 0/4/8/12/16°; five independent setups.
- Segmentation: >=240 short clips balanced across four clay colors, wet/dry, three backdrops, four lighting conditions, hands/tools/sponges, splash pan/clutter, motion blur. Annotate every tenth processed frame.
- Profile: analytic cylinders/tapers/bellies/necks/rims with ±2/5/10/20 mm regional perturbations and missing rows.
- Wobble: seeded renderings plus a dial-indicator-verified eccentric physical rig at 0/2/5/10/20 mm; negatives include camera movement, stationary asymmetry, collaring, occlusion, lighting, wheel vibration.
- Coaching: scripted observation streams plus instructor-reviewed recorded sessions.

## Governance

Every fixture has ID, license/consent, expected labels, acquisition metadata, checksum, split, and deletion date. Research footage consent is separate from product consent. Learned-model work requires a model card, subject/studio split, subgroup/condition results, calibration, and a demonstrated gain over geometry.

## Evaluation release rule

No metric can improve by discarding hard inputs: setup rejection and unmeasurable output are first-class results. Thresholds are preregistered in `benchmarks/manifests/*.json`; raw results are immutable JSONL and summaries are generated.
