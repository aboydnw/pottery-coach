# Field release review

Decision: **retain as a controlled research prototype pending consolidated gates**.

The automated implementation suite supports continued internal testing. Field release is not approved because physical iPhone/Android performance, provider-account privacy, VoiceOver/TalkBack, novice completion, and two-instructor cue review have not yet been run. Numeric claims require valid calibration; proactive wobble and cloud voice remain disabled by default; mobile support remains unclaimed.

After the consolidated test, reviewers must map every acceptance criterion to an artifact, assign each residual critical/high risk an owner, trigger, and fallback, then choose exactly one release decision. Missing evidence cannot be converted into acceptance.

| Residual risk | Owner | Trigger | Fallback |
|---|---|---|---|
| Mobile thermal/frame-age failure | Performance reviewer | Any supported phone misses the integrated thresholds | Narrow device support; open native assessment |
| Unsupported numeric claim | Vision/trust reviewers | Claim lacks fresh eligible evidence | Disable numeric mode and retain visual-only uncertainty |
| Provider privacy mismatch | Privacy/security reviewers | Account retention, region, subprocessors, or deletion cannot be verified | Keep cloud voice disabled |
| Incorrect or distracting proactive cue | Two wheel instructors | Reject, disagreement, or critical participant feedback | Keep the cue disabled or narrow its approved condition |
| Assistive-technology critical-path failure | Accessibility reviewer | VoiceOver/TalkBack cannot complete setup/live/end | Block affected mobile support |
