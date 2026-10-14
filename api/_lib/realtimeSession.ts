import { realtimeSessionRequestSchema } from "../../src/voice/sessionSchema";
import { COACH_INSTRUCTIONS } from "../../src/voice/instructions";
import { REALTIME_TOOL_DEFINITIONS } from "../../src/voice/tools/definitions";

const VOICE = "marin";
const MAX_BODY_BYTES = 200_000;

export type RealtimeErrorCode = "VOICE_RATE_LIMITED" | "VOICE_PROVIDER_ERROR" | "VOICE_CONFIG_MISMATCH";

export type RealtimeSessionDependencies = {
  apiKey: string;
  model: string;
  fetch: typeof globalThis.fetch;
  authenticate(request: Request): Promise<boolean>;
  verifyOrigin(request: Request): boolean;
  allowRequest(request: Request): boolean;
  log(event: { requestId: string; status: string }): void;
};

/**
 * Exchanges a browser WebRTC SDP offer for a provider answer.
 * Model, voice, instructions, and tools are always set server-side; client-supplied values are ignored.
 */
export async function handleRealtimeSession(request: Request, dependencies: RealtimeSessionDependencies): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return error("VOICE_PROVIDER_ERROR", 405);
  if (!await dependencies.authenticate(request)) return error("VOICE_PROVIDER_ERROR", 401);
  if (!dependencies.verifyOrigin(request)) return error("VOICE_PROVIDER_ERROR", 403);
  if (!dependencies.allowRequest(request)) return error("VOICE_RATE_LIMITED", 429);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("VOICE_PROVIDER_ERROR", 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error("VOICE_PROVIDER_ERROR", 413);
  let parsed: ReturnType<typeof realtimeSessionRequestSchema.safeParse>;
  try { parsed = realtimeSessionRequestSchema.safeParse(await request.json()); }
  catch { return error("VOICE_PROVIDER_ERROR", 400); }
  if (!parsed.success) return error(parsed.error.issues.some((issue) => issue.path[0] === "clientConfigVersion") ? "VOICE_CONFIG_MISMATCH" : "VOICE_PROVIDER_ERROR", 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const form = new FormData();
    form.set("sdp", parsed.data.sdp);
    form.set("session", JSON.stringify({ type: "realtime", model: dependencies.model, audio: { output: { voice: VOICE }, input: { turn_detection: { type: "server_vad" } } },
      instructions: COACH_INSTRUCTIONS, tools: REALTIME_TOOL_DEFINITIONS }));
    const provider = await dependencies.fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", headers: { Authorization: `Bearer ${dependencies.apiKey}` }, body: form, signal: controller.signal,
    });
    if (!provider.ok) {
      dependencies.log({ requestId, status: "provider-error" });
      return error(provider.status === 429 ? "VOICE_RATE_LIMITED" : "VOICE_PROVIDER_ERROR", provider.status === 429 ? 429 : 502);
    }
    const answer = await provider.text();
    dependencies.log({ requestId, status: "connected" });
    return new Response(answer, { status: 200, headers: { "content-type": "application/sdp", "cache-control": "no-store, private", "x-request-id": requestId } });
  } catch {
    dependencies.log({ requestId, status: "provider-error" });
    return error("VOICE_PROVIDER_ERROR", 502);
  } finally { clearTimeout(timeout); }
}

function error(code: RealtimeErrorCode, status: number): Response {
  return Response.json({ error: code }, { status, headers: { "cache-control": "no-store, private" } });
}
