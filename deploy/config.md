# Deployment configuration

Deploy the built static assets on an HTTPS origin. Mount the ephemeral realtime-session handler on the same origin at `/api/realtime/session`; keep `OPENAI_API_KEY` only in the host secret store. Apply `headers.json`, verify the health page, camera permission, and session endpoint cache headers before traffic is switched. Roll back by restoring the previous immutable artifact and revoking the affected provider configuration.

Configure an SPA fallback from `/session/*` to `/index.html` while preserving `/api/*` routing. The deployment health check is `/health.json`; it must be served without invoking camera, microphone, or provider code.
