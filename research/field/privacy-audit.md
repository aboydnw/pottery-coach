# Privacy audit

Status: implementation audit complete; provider-account and physical bystander checks pending consolidated review.

Camera pixels remain in the local frame pipeline and are not written to session storage. Continuous microphone audio is not stored by the app. Structured sessions are downsampled, consent-scoped, expire after 30 days, and have inventory-based idempotent deletion. The default voice mode is a local mock. Deployment restricts camera/microphone permissions and network destinations.

Before field release, a privacy reviewer must verify the deployed data flow, bystander procedure, configured provider retention/ZDR, region, subprocessors, provider deletion exception, and real browser storage/network traces on the supported phones.
