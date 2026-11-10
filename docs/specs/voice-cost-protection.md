# Voice admission and public-launch blockers

Status: implemented admission guard, not a public paid service or a provider spend cap.

## What is enforced

Every voice start authenticates the signed Cloudflare Access token and checks Origin before any OpenAI request. A client-provided user ID, plan, admin flag, session ID, credit balance, or usage report cannot grant access. JSON bodies are limited by actual streamed bytes, not only Content-Length.

`VOICE_ADMISSION_MODE` defaults to `owner-only` in the Worker deployment configuration:

- `owner-only`: only an exact account in the server-only `VOICE_ADMIN_USER_IDS` allowlist can start cloud voice. An empty allowlist admits nobody. Local development does not implicitly become admin.
- `limited-preview`: allows the existing, deliberately restricted Cloudflare Access audience to use the start allowances below. This is **not a public-release switch**. Do not open the Access audience to public signup while using this direct WebRTC architecture.
- `off`: blocks new voice starts for everyone, including admins. Unknown mode values also block everyone.

Admins bypass the IP and personal start quotas, but every admin start still reserves against the site-wide daily and monthly caps. Authentication, allowed Origin, valid bounded requests, a healthy durable ledger and an enabled provider remain required. No owner identity is hard-coded, and this change does not configure any live administrator. The separate stop setting prevents new calls; it cannot terminate an existing direct WebRTC call.

Preview limits are deliberately provisional request counts, not product pricing:

| Allowance | Rolling minute | UTC day | UTC month |
| --- | ---: | ---: | ---: |
| Free | 1 | 2 | 3 |
| Paid entitlement | 3 | 10 | 60 |
| All accounts combined, including admins | — | 20 | 100 |

The site-wide defaults can be changed only server-side with `VOICE_GLOBAL_DAILY_START_LIMIT` and `VOICE_GLOBAL_MONTHLY_START_LIMIT`. Values must be positive decimal integers from 1 to 1,000,000; empty, malformed or out-of-range values close admission for everyone, including admins. Missing values use the defaults above. These absolute caps are independent of personal tiers and the emergency `off` switch. Raising a cap allows more starts and can increase real spending; a start count is still not a dollar budget.

An account is free unless the D1 `voice_entitlements` table has a `paid` row for its exact verified user ID with an unexpired `expires_at` Unix-millisecond timestamp. Entitlements have no client-write API and are not modified by `/api/sync`. No checkout, subscription, recurring charge, payment webhook, or dollar balance exists in this implementation. The table is a server-side integration point for a later verified billing flow. Do not grant paid status based on browser claims.

One conditional SQL insert reserves the start atomically against both account and aggregate limits. This is durable across Worker instances and restarts. A failed or uncertain provider call still consumes a start; there is no unsafe refund path that could be abused by making the upstream result ambiguous. Reconnects also consume starts. Invalid requests rejected before admission do not. Database failure is closed, never an in-memory fallback. A quota response is 429; the client stops automatic retry loops, releases microphone/peer resources and keeps touch/camera operation available. Retry-After is a minimum 60-second delay, not a promise that a day/month allowance has reset.

The ledger stores request ID, verified account ID, entitlement tier, and timestamp only. It stores no audio, SDP, transcript, provider key, or client-supplied usage. Existing rows are retained for review; a scheduled retention policy is still to be chosen before public release.

## What is not enforced

The browser sends audio directly to OpenAI after the SDP exchange. It can issue data-channel messages and does not provide trustworthy usage accounting. The Worker does not own the call lifetime or number of responses. The one-hour browser cleanup timer, 512-token initial reply setting, and history truncation help ordinary sessions but are **not adversarial cost boundaries**. A single admitted call may consume substantial provider usage.

The shared admission limits cover owner starts but do not bound the spending of an admitted or already-running call, other services using the same provider project, or hosting/database charges. Compromised owner credentials still enable calls within the aggregate allowance. Owner exemption from personal quotas and maximum total spend are separate decisions; the aggregate start cap is not a financial cap.

## Before public access or selling credits

1. Add a server-owned, enforceable lifetime/concurrency control for every paid operation. Direct-client controls and client-reported usage are insufficient. Exercise forced disconnects, lost responses, delayed termination and provider outages.
2. Collect usage from a trusted provider/server channel; reserve worst-case cost atomically before work, reconcile actual usage idempotently, and stop new work when any account or aggregate budget is exhausted. Include input, output, cached tokens, transcription, retries, tools and concurrency.
3. Verify current provider model prices and project/account enforcement. Inspect the provider's actual hard-limit and prepaid/autorecharge settings, not merely a monthly alert label. Hard limits and prepaid depletion may have enforcement delay; retain a safety margin. No provider billing settings were changed by this code.
4. Implement verified billing entitlements, subscription expiry/cancellation/refunds, credit reset and top-up rules, and a visible balance before offering a paid plan. The owner's proposed $10/month / $10 credit is provisional, not implemented or guaranteed by these start counts.
5. Set a deliberate global budget/emergency policy and provision the owner's verified admin identity. Keep Access restricted until the above controls are tested with the actual deployment and provider. A draft PR or passing mocked tests is not approval to deploy or open access.

Provider billing background: [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits) and [prepaid billing](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing). Check the live account before making an account-specific promise.
