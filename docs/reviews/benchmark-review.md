# Benchmark review

## Validity threats

- Adjacent-frame random splits leak conditions; split by participant/studio/session.
- Synthetic wobble alone cannot establish physical specificity; require dial-indicator rig and real hand-contact negatives.
- Frame accuracy hides user harm; report false proactive alerts per 10 minutes, detection delay, and abstention.
- Calibration averages can hide angle/offset bias; publish condition distributions and signed bias.
- Rejecting hard inputs can inflate metrics; setup rejection/unmeasurable rates are primary metrics.
- Tuning and evaluation must use separate fixtures with frozen config/commit.
- Voice latency needs device/network/noise stratification and provider-reported usage, not desktop only.

## Resolution

Research 07/10 and all benchmark plans specify immutable manifests/JSONL, per-condition values, numerator/denominator/exclusions, cluster bootstrap intervals, strong negatives, and pre-registered thresholds. Current results correctly say “not run”; no paper analysis is presented as a pass.

Benchmark design is accepted. Empirical gates remain unresolved.
