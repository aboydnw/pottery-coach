import { realtimeSessionRequestSchema } from "../../src/voice/sessionSchema";

const MODEL = "gpt-realtime-2.1-mini";
const VOICE = "marin";

type Dependencies = {
  apiKey: string;
  fetch: typeof globalThis.fetch;
  authenticate(request: Request): Promise<boolean>;
  verifyCsrf(request: Request): boolean;
  allowRequest(sessionId: string): boolean;
  log(event: { requestId: string; status: string }): void;
};

export async function handleRealtimeSession(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return error("VOICE_PROVIDER_ERROR", 405);
  if (!await dependencies.authenticate(request)) return error("VOICE_PROVIDER_ERROR", 401);
  if (!dependencies.verifyCsrf(request)) return error("VOICE_PROVIDER_ERROR", 403);
  let parsed: ReturnType<typeof realtimeSessionRequestSchema.safeParse>;
  try { parsed = realtimeSessionRequestSchema.safeParse(await request.json()); }
  catch { return error("VOICE_PROVIDER_ERROR", 400); }
  if (!parsed.success) return error(parsed.error.issues.some((issue) => issue.path[0] === "clientConfigVersion") ? "VOICE_CONFIG_MISMATCH" : "VOICE_PROVIDER_ERROR", 400);
  if (!dependencies.allowRequest(parsed.data.sessionId)) return error("VOICE_RATE_LIMITED", 429);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const form = new FormData();
    form.set("sdp", parsed.data.sdp);
    form.set("session", JSON.stringify({ type: "realtime", model: MODEL, audio: { output: { voice: VOICE }, input: { turn_detection: { type: "server_vad" } } }, instructions: "Use tools for every measurement. Never guess a number.", tools: [] }));
    const provider = await dependencies.fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", headers: { Authorization: `Bearer ${dependencies.apiKey}` }, body: form, signal: controller.signal,
    });
    if (!provider.ok) {
      dependencies.log({ requestId, status: "provider-error" });
      return error(provider.status === 429 ? "VOICE_RATE_LIMITED" : "VOICE_PROVIDER_ERROR", provider.status === 429 ? 429 : 502);
    }
    const answer = await provider.text();
    dependencies.log({ requestId, status: "connected" });
    return new Response(answer, { status: 200, headers: { "content-type": "application/sdp", "x-request-id": requestId } });
  } catch {
    dependencies.log({ requestId, status: "provider-error" });
    return error("VOICE_PROVIDER_ERROR", 502);
  } finally { clearTimeout(timeout); }
}

function error(code: "VOICE_RATE_LIMITED" | "VOICE_PROVIDER_ERROR" | "VOICE_CONFIG_MISMATCH", status: number): Response {
  return Response.json({ error: code }, { status });
}
