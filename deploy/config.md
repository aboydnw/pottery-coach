# Deployment configuration

Deploy the built static assets on an HTTPS origin. `api/realtime/session.ts` exports a Web-standard `POST(request)` handler, which Vercel serves as a function at `/api/realtime/session`; on another host, mount the same function on that path. Files under `api/_lib/` are shared modules, not routes.

Set these only in the host secret store:

- `OPENAI_API_KEY` and `REALTIME_ACCESS_TOKEN`: cloud voice returns `503 VOICE_DISABLED` until both exist. Field-test clients send the access token as `Authorization: Bearer …`.
- `REALTIME_ALLOWED_ORIGINS` (optional): extra origins, comma-separated, allowed besides the deployment's own origin.
- `VOICE_MODEL` (optional): defaults to `gpt-realtime-2.1-mini`.

The endpoint rejects requests without a matching `Origin` header and rate-limits each client address to 10 sessions per minute. That limiter is in memory, so it applies per function instance; move it to a shared store before opening the endpoint beyond a controlled test.

Apply `headers.json`, verify the health page, camera permission, and session endpoint cache headers before traffic is switched. The Content Security Policy includes `'wasm-unsafe-eval'` because the AprilTag detector compiles WebAssembly. Roll back by restoring the previous immutable artifact and revoking the affected provider configuration.

Configure an SPA fallback from `/session/*` to `/index.html` while preserving `/api/*` routing. The deployment health check is `/health.json`; it must be served without invoking camera, microphone, or provider code.
