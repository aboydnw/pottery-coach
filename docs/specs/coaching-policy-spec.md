# Coaching policy specification

```ts
type ThrowingPhase = "setup"|"centering"|"opening"|"raising-walls"|"shaping"|"finishing"|"session-ended"|"uncertain";
type CuePriority = 1|2|3|4|5|6;
type CuePolicy = { id:string; revision:number; trigger:string; requiredConfidence:number; maxFreshnessMs:number; minimumPersistenceMs:number; priority:CuePriority; cooldownMs:number; suppressions:string[]; spokenExamples:string[]; prohibitedWording:string[]; auditEvent:string; instructorApprovalId:string|null };
type CueCandidate = { policyId:string; createdAtMs:number; expiresAtMs:number; evidenceIds:string[]; facts:Record<string,string|number|boolean|null>; priority:CuePriority };
```

Priorities: 1 urgent visible instability; 2 direct question; 3 goal milestone; 4 suggested correction; 5 encouragement; 6 review-only. Only priority 1 may interrupt the coach, and only after its gate/approval. Direct questions preempt queued non-urgent cues. Non-urgent global cooldown is 20 s; same-policy cooldown 60 s; encouragement 180 s. A materially new region/direction can replace a queued correction but cannot violate global cooldown.

Every policy requires evidence, confidence, freshness, persistence, cooldown, absence of occlusion/active large shape change, and instructor approval before enablement. Low confidence yields silence proactively and an uncertainty answer reactively. Facts are immutable; phrasing may round to measurement uncertainty but never add a cause or number.

Required V1 policies: measurement-unavailable (reactive); current-height/width (reactive); visible-centering status (reactive); target regional difference (reactive and, after approval, priority 4); target-height milestone (priority 3); significant visible oscillation (feature-gated priority 1); pause/resume/end confirmations. Prohibited wording is normative from privacy/safety spec.
