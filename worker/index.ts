import { identify, type Identity } from "./access";
import { clientAddress, isSameOrigin } from "./guards";
import { handleRealtimeSession } from "./realtimeSession";
import { handleSync } from "./sync";

const DEFAULT_MODEL = "gpt-realtime-2.1-mini";
const API_HEADERS = {
  "cache-control": "no-store, private",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/**
 * Secrets, set in the dashboard (deploys never overwrite them). Voice stays off without the OpenAI
 * key; without the Access settings nobody is signed in, except the development user on localhost.
 */
type WorkerEnv = Env & { OPENAI_API_KEY?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_POLICY_AUD?: string };

/**
 * Serves `/api/*` and hands every other request to the static assets (the Vite build), which are
 * configured for single-page-application fallback in wrangler.jsonc.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/realtime/session") return withApiHeaders(await realtimeSession(request, env));
    if (pathname === "/api/sync") return withApiHeaders(await sync(request, env));
    if (pathname.startsWith("/api/")) return withApiHeaders(Response.json({ error: "NOT_FOUND" }, { status: 404 }));
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;

async function realtimeSession(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST")
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
  if (!env.OPENAI_API_KEY) return Response.json({ error: "VOICE_DISABLED" }, { status: 503 });
  const allowedOrigins = env.REALTIME_ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return handleRealtimeSession(request, {
    apiKey: env.OPENAI_API_KEY,
    model: env.VOICE_MODEL || DEFAULT_MODEL,
    transcriptionModel: env.VOICE_TRANSCRIPTION_MODEL || undefined,
    fetch: (input, init) => fetch(input, init),
    authenticate: async (incoming) => (await signedIn(incoming, env)) !== null,
    verifyOrigin: (incoming) => isSameOrigin(incoming, allowedOrigins),
    allowRequest: async (incoming) => (await env.REALTIME_RATE_LIMITER.limit({ key: clientAddress(incoming) })).success,
    log: (event) => console.info(JSON.stringify({ route: "realtime-session", ...event })),
  });
}

async function sync(request: Request, env: WorkerEnv): Promise<Response> {
  const identity = await signedIn(request, env);
  if (!identity) return Response.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "CROSS_ORIGIN" }, { status: 403 });
  if (!(await env.SYNC_RATE_LIMITER.limit({ key: identity.userId })).success)
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  return handleSync(request, { db: env.DB, userId: identity.userId, now: () => Date.now() });
}

function signedIn(request: Request, env: WorkerEnv): Promise<Identity | null> {
  return identify(request, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_POLICY_AUD });
}

function withApiHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(API_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
