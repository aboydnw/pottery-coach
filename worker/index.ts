import { clientAddress, hasBearerToken, isSameOrigin } from "./guards";
import { handleRealtimeSession } from "./realtimeSession";

const DEFAULT_MODEL = "gpt-realtime-2.1-mini";
const API_HEADERS = {
  "cache-control": "no-store, private",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/** Secrets are optional so cloud voice can stay disabled until both are set with `wrangler secret put`. */
type WorkerEnv = Env & { OPENAI_API_KEY?: string; REALTIME_ACCESS_TOKEN?: string };

/**
 * Serves `/api/*` and hands every other request to the static assets (the Vite build), which are
 * configured for single-page-application fallback in wrangler.jsonc.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/realtime/session") return withApiHeaders(await realtimeSession(request, env));
    if (pathname.startsWith("/api/")) return withApiHeaders(Response.json({ error: "NOT_FOUND" }, { status: 404 }));
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;

async function realtimeSession(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST")
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
  if (!env.OPENAI_API_KEY || !env.REALTIME_ACCESS_TOKEN)
    return Response.json({ error: "VOICE_DISABLED" }, { status: 503 });
  const accessToken = env.REALTIME_ACCESS_TOKEN;
  const allowedOrigins = env.REALTIME_ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return handleRealtimeSession(request, {
    apiKey: env.OPENAI_API_KEY,
    model: env.VOICE_MODEL || DEFAULT_MODEL,
    fetch: (input, init) => fetch(input, init),
    authenticate: (incoming) => hasBearerToken(incoming, accessToken),
    verifyOrigin: (incoming) => isSameOrigin(incoming, allowedOrigins),
    allowRequest: async (incoming) => (await env.REALTIME_RATE_LIMITER.limit({ key: clientAddress(incoming) })).success,
    log: (event) => console.info(JSON.stringify({ route: "realtime-session", ...event })),
  });
}

function withApiHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(API_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
