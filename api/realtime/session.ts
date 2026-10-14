import { clientAddress, createRateLimiter, hasBearerToken, isSameOrigin } from "../_lib/guards";
import { handleRealtimeSession } from "../_lib/realtimeSession";

const DEFAULT_MODEL = "gpt-realtime-2.1-mini";
const allow = createRateLimiter({ limit: 10, windowMs: 60_000 });

/**
 * Vercel function for `POST /api/realtime/session`. Cloud voice stays disabled (503) until both
 * `OPENAI_API_KEY` and `REALTIME_ACCESS_TOKEN` are configured in the host's secret store.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  const accessToken = process.env.REALTIME_ACCESS_TOKEN;
  if (!apiKey || !accessToken)
    return Response.json(
      { error: "VOICE_DISABLED" },
      { status: 503, headers: { "cache-control": "no-store, private" } },
    );
  const allowedOrigins = (process.env.REALTIME_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return handleRealtimeSession(request, {
    apiKey,
    model: process.env.VOICE_MODEL || DEFAULT_MODEL,
    fetch: globalThis.fetch,
    authenticate: (incoming) => hasBearerToken(incoming, accessToken),
    verifyOrigin: (incoming) => isSameOrigin(incoming, allowedOrigins),
    allowRequest: (incoming) => allow(clientAddress(incoming)),
    log: (event) => console.info(JSON.stringify({ route: "realtime-session", ...event })),
  });
}
