# Privacy, safety, and trust

## Default data flow

Raw frames remain on device and are discarded after processing. Continuous video is never sent to the voice provider. Microphone audio, minimum conversation context, function names/arguments/results, and model audio cross the provider boundary. Stills require a separate per-session opt-in. Analytics/session-replay SDKs are disabled on capture routes.

Before browser prompts, disclose camera-local processing, named audio provider, transcript policy, default no-video retention, and pause/stop/delete controls. Request camera then microphone for explained purposes. Show persistent camera/mic/cloud indicators. Pause/stop ends the applicable media tracks and invalidates freshness. Shared-studio setup requires bystander notice acknowledgment and offers push-to-talk/local-only mode.

The ICO treats continuous audio as especially intrusive and recommends purpose justification, notice, and purpose-limited retention ([guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/cctv-and-video-surveillance/guidance-on-video-surveillance-including-cctv/how-can-we-comply-with-the-data-protection-principles-when-using-surveillance-systems/)). Media track lifecycle follows [W3C Media Capture](https://www.w3.org/TR/mediacapture-streams/).

## Retention/deletion

- Application raw video/audio: none by default.
- Local structured sessions: 30-day auto-expiry, user-shortenable.
- Content-free operational telemetry: <=30 days.
- Research media: separate opt-in, explicit purpose/viewers/provider exposure/deletion date; default max 30 days before deletion or approved de-identification.
- Delete removes local records, stills, backend rows, object derivatives, indexes, and queued exports, then provides a receipt; provider/legal exceptions are disclosed.

Provider manifests record policy URL/version, account tier, region, retention, ZDR eligibility/config, subprocessors, and review date. OpenAI states API data is not used for training by default and standard abuse logs may be kept up to 30 days, with endpoint/eligibility-dependent controls ([data controls](https://developers.openai.com/api/docs/guides/your-data)). Paid Gemini content is treated differently from unpaid content; verify account and ZDR behavior at deployment ([terms](https://ai.google.dev/gemini-api/terms), [ZDR](https://ai.google.dev/gemini-api/docs/zdr)).

## Safety language

Allowed: external silhouette, visible motion, confidence, staleness, target differences. Prohibited: thickness, pressure, moisture, internal centering, structural safety, causal hand diagnosis, air bubbles, guaranteed outcome. The coach is a visual aid, not a safety monitor or instructor replacement.
