# Deployment

Pottery Coach runs on Cloudflare Workers at **https://potterycoach.anthonynboyd.com**. A single Worker serves the Vite build as static assets and handles `/api/*` itself. Everything is declared in [`wrangler.jsonc`](../wrangler.jsonc):

- **Custom domain:** `potterycoach.anthonynboyd.com`. Cloudflare creates the DNS record and TLS certificate on the first deploy, so the `anthonynboyd.com` zone must be in the same account and the hostname must not already have a conflicting DNS record. `workers.dev` and preview URLs are off.
- **Static assets:** `dist/`, with single-page-application fallback so `/session/*` serves `index.html`. Only `/api/*` runs the Worker first ([`worker/index.ts`](../worker/index.ts)).
- **Response headers:** [`public/_headers`](../public/_headers) sets the Content Security Policy, permissions policy and cache rules for static files. The policy includes `'wasm-unsafe-eval'` because the AprilTag detector compiles WebAssembly. `_headers` does not apply to Worker responses, so the Worker sets `no-store` on API responses itself.
- **Rate limiting:** the `REALTIME_RATE_LIMITER` binding allows 10 voice sessions per client address per minute, using Cloudflare's rate limiting API.

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

## Cloud voice secrets

Cloud voice stays off (`503 VOICE_DISABLED`) until both secrets exist. Set them in the dashboard under the Worker's **Settings → Variables and Secrets**, or with Wrangler, which prompts for the value so it never appears in shell history:

```sh
pnpm exec wrangler secret put OPENAI_API_KEY
pnpm exec wrangler secret put REALTIME_ACCESS_TOKEN
```

`wrangler secret put` deploys a new version immediately. Field-test clients send the access token as `Authorization: Bearer …`. `REALTIME_ALLOWED_ORIGINS` (comma-separated) and `VOICE_MODEL` are plain variables in `wrangler.jsonc`. For local `wrangler dev`, copy `.dev.vars.example` to `.dev.vars`.

The app's release manifest still keeps cloud voice switched off in the UI, so setting the secrets alone exposes nothing to users.

## Manual deploys and checks

```sh
pnpm deploy:dry-run   # build and validate the Worker bundle without uploading
pnpm preview:worker   # build and serve the Worker locally with wrangler dev
pnpm deploy           # build and deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN)
```

Before switching traffic, check that the health page (`/health.json`, served with `no-store` and without loading camera, microphone or provider code), camera permission on a phone, and the session endpoint's cache headers all behave. To roll back, use **Deployments** in the dashboard (or `wrangler rollback`) and revoke the provider key if it was exposed.
