# Deployment

Pottery Coach runs on Cloudflare Workers at **https://potterycoach.anthonynboyd.com**. A single Worker serves the Vite build as static assets and handles `/api/*` itself. Everything is declared in [`wrangler.jsonc`](../wrangler.jsonc):

- **Custom domain:** `potterycoach.anthonynboyd.com`. Cloudflare creates the DNS record and TLS certificate on the first deploy, so the `anthonynboyd.com` zone must be in the same account and the hostname must not already have a conflicting DNS record. `workers.dev` and preview URLs are off.
- **Static assets:** `dist/`, with single-page-application fallback so `/session/*` serves `index.html`. Only `/api/*` runs the Worker first ([`worker/index.ts`](../worker/index.ts)).
- **Response headers:** [`public/_headers`](../public/_headers) sets the Content Security Policy, permissions policy and cache rules for static files. The policy includes `'wasm-unsafe-eval'` because the AprilTag detector compiles WebAssembly. `_headers` does not apply to Worker responses, so the Worker sets `no-store` on API responses itself.
- **Rate limiting:** `REALTIME_RATE_LIMITER` allows 10 voice sessions per client address per minute, and `SYNC_RATE_LIMITER` 30 syncs per potter per minute, using Cloudflare's rate limiting API.
- **Database:** the `DB` binding is a D1 database (`pottery-coach`) holding each potter's throw log and lasting notes. Wrangler creates it on the first deploy, and the Worker creates its tables on first use, so there are no migrations to run.

## Workers Builds (continuous deployment)

Connect the GitHub repository once in the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, then pick `aboydnw/pottery-coach`.

| Setting           | Value                       |
| ----------------- | --------------------------- |
| Production branch | `main`                      |
| Build command     | `pnpm build`                |
| Deploy command    | `pnpm exec wrangler deploy` |
| Root directory    | `/`                         |

Workers Builds reads Node 24 from `.nvmrc` and pnpm from `packageManager` in `package.json`. Every push to `main` then builds and deploys. Leave non-production branch builds off. Preview URLs are disabled because they would sit on `workers.dev`, outside the custom domain.

## Unverified measurements on this deployment

`.env.production` sets `VITE_UNVERIFIED_MEASUREMENTS=true`, so the live site shows millimetre measurements before the physical measurement gate passes. The UI labels them "unverified", and `src/release/manifest.ts` still records the gate as pending. Delete that line to return to strict gating. In that mode a session can still run in shape-only mode, but sizes are never shown.

## Sign-in (Cloudflare Access)

The whole site sits behind Cloudflare Access, which signs potters in with a one-time code sent by email. The Worker checks Access's signed token on every `/api/*` request and keys all stored data by the signed-in email; without it, voice and sync answer `401`.

1. In the dashboard, open **Zero Trust** and pick a team name (this gives `https://<team>.cloudflareaccess.com`).
2. **Access → Applications → Add an application → Self-hosted**: domain `potterycoach.anthonynboyd.com`, session duration **1 month**, identity provider **One-time PIN**.
3. Add a policy: **Allow**, include **Emails** and list who may use the app. Inviting someone later is just adding their email here.
4. Copy the application's **Audience (AUD) tag** from its settings.
5. On the Worker, under **Settings → Variables and Secrets**, add these as **Secrets** (deploys never overwrite secrets, but they do reset plain variables):
   - `ACCESS_TEAM_DOMAIN`: `https://<team>.cloudflareaccess.com`
   - `ACCESS_POLICY_AUD`: the AUD tag

On `localhost`, with no Access settings, the Worker signs everyone in as `dev@localhost` so development and tests work.

## Cloud voice secret

Cloud voice stays off (`503 VOICE_DISABLED`) until `OPENAI_API_KEY` exists. Set it as a Secret in the dashboard, or with Wrangler, which prompts for the value so it never appears in shell history:

```sh
pnpm exec wrangler secret put OPENAI_API_KEY
```

`wrangler secret put` deploys a new version immediately. Only signed-in potters can start a voice session. `.env.production` sets `VITE_CLOUD_VOICE=true`; the release manifest still records the provider gate as pending. Set a monthly budget on the OpenAI project too (**platform.openai.com → Settings → Limits**): the Worker never sees what a session costs, because audio goes straight from the phone to OpenAI.

Plain variables in `wrangler.jsonc`:

- `VOICE_MODEL`: the realtime model.
- `VOICE_TRANSCRIPTION_MODEL`: empty by default. Set it (for example `gpt-live-transcribe`) to caption what the potter says as well as what the coach says. It is opt-in because an unsupported model makes the whole session request fail; if voice stops connecting after setting it, clear it again.
- `REALTIME_ALLOWED_ORIGINS`: extra allowed origins, comma-separated.

For local `wrangler dev`, copy `.dev.vars.example` to `.dev.vars`.

## Manual deploys and checks

```sh
pnpm deploy:dry-run   # build and validate the Worker bundle without uploading
pnpm preview:worker   # build and serve the Worker locally with wrangler dev
pnpm deploy           # build and deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN)
```

Before switching traffic, check that the health page (`/health.json`, served with `no-store` and without loading camera, microphone or provider code), camera permission on a phone, and the session endpoint's cache headers all behave. To roll back, use **Deployments** in the dashboard (or `wrangler rollback`) and revoke the provider key if it was exposed.
