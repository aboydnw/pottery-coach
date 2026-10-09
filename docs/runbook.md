# Controlled prototype runbook

## Start and verify

Use Node 24 and pnpm 10. Install dependencies, run the full verification scripts, then build and deploy over HTTPS. Camera permission is explicit; microphone permission is separate. The default voice transport is the local mock until the provider gate passes.

## Operational boundaries

Numeric mode requires a valid current calibration. Calibration loss suppresses numeric claims. Voice, proactive cues, wobble, and storage degrade independently. Raw frames and continuous audio are never persisted. Structured sessions expire after 30 days.

## Incidents and rollback

For a provider outage, disable cloud voice and retain the visual workflow. For calibration invalidation, suppress measurements and require recalibration. For a deletion incident, stop sync/provider features, inventory stores, preserve only consented diagnostics, and follow the field incident plan. Roll back to the previous immutable artifact and revoke affected realtime configuration.
