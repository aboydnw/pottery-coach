import { realtimeSessionRequestSchema } from "../src/voice/sessionSchema";
import { buildInstructions } from "../src/voice/instructions";
import { REALTIME_TOOL_DEFINITIONS } from "../src/voice/tools/definitions";

const VOICE = "marin";
const MAX_BODY_BYTES = 200_000;
/** Conversation history (excluding instructions and tools) each reply may read. */
const MAX_HISTORY_TOKENS = 8_000;

export type RealtimeErrorCode = "VOICE_RATE_LIMITED" | "VOICE_PROVIDER_ERROR" | "VOICE_CONFIG_MISMATCH";

export type RealtimeSessionDependencies = {
  apiKey: string;
  model: string;
  /** Optional speech-to-text model for captions of what the potter said; omitted when empty. */
  transcriptionModel?: string;
  fetch: typeof globalThis.fetch;
  authenticate(request: Request): Promise<boolean>;
  verifyOrigin(request: Request): boolean;
  allowRequest(request: Request): boolean | Promise<boolean>;
  /** Durable, fail-closed admission. Called after validation and before any provider request. */
  reserveStart(requestId: string): Promise<Response | null>;
  log(event: { requestId: string; status: string }): void;
};

/**
 * Exchanges a browser WebRTC SDP offer for a provider answer.
 * Model, voice, instructions, and tools are always set server-side; client-supplied values are ignored.
 */
export async function handleRealtimeSession(
  request: Request,
  dependencies: RealtimeSessionDependencies,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return error("VOICE_PROVIDER_ERROR", 405);
  if (!(await dependencies.authenticate(request))) return error("VOICE_PROVIDER_ERROR", 401);
  if (!dependencies.verifyOrigin(request)) return error("VOICE_PROVIDER_ERROR", 403);
  try {
    if (!(await dependencies.allowRequest(request))) return error("VOICE_RATE_LIMITED", 429);
  } catch {
    return error("VOICE_PROVIDER_ERROR", 503);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return error("VOICE_PROVIDER_ERROR", 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error("VOICE_PROVIDER_ERROR", 413);
  let parsed: ReturnType<typeof realtimeSessionRequestSchema.safeParse>;
  try {
    const body = await boundedBody(request);
    if (body === null) return error("VOICE_PROVIDER_ERROR", 413);
    parsed = realtimeSessionRequestSchema.safeParse(JSON.parse(body));
  } catch {
    return error("VOICE_PROVIDER_ERROR", 400);
  }
  if (!parsed.success)
    return error(
      parsed.error.issues.some((issue) => issue.path[0] === "clientConfigVersion")
        ? "VOICE_CONFIG_MISMATCH"
        : "VOICE_PROVIDER_ERROR",
      400,
    );
  try {
    const denied = await dependencies.reserveStart(requestId);
    if (denied) return denied;
  } catch {
    return error("VOICE_PROVIDER_ERROR", 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const form = new FormData();
    form.set("sdp", parsed.data.sdp);
    form.set(
      "session",
      JSON.stringify({
        type: "realtime",
        model: dependencies.model,
        // Reduces ordinary per-turn output, but the direct client channel is not a spend boundary.
        max_output_tokens: 512,
        audio: {
          output: { voice: VOICE },
          input: {
            // Studio noise (wheel motor, water, radio) must not count as the potter speaking: filter for a
            // close headset mic, and only take a turn when it sounds like real speech.
            noise_reduction: { type: "near_field" },
            turn_detection: { type: "semantic_vad", eagerness: "low" },
            ...(dependencies.transcriptionModel ? { transcription: { model: dependencies.transcriptionModel } } : {}),
          },
        },
        // Every reply re-reads the conversation so far, so long sessions get dearer per reply. Keep only
        // recent history, and drop a fifth extra when trimming so the prompt cache survives longer.
        truncation: {
          type: "retention_ratio",
          retention_ratio: 0.8,
          token_limits: { post_instructions: MAX_HISTORY_TOKENS },
        },
        instructions: buildInstructions(parsed.data.potterContext),
        tools: REALTIME_TOOL_DEFINITIONS,
      }),
    );
    const provider = await dependencies.fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${dependencies.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!provider.ok) {
      dependencies.log({ requestId, status: "provider-error" });
      return error(
        provider.status === 429 ? "VOICE_RATE_LIMITED" : "VOICE_PROVIDER_ERROR",
        provider.status === 429 ? 429 : 502,
      );
    }
    const answer = await provider.text();
    dependencies.log({ requestId, status: "connected" });
    return new Response(answer, {
      status: 200,
      headers: { "content-type": "application/sdp", "cache-control": "no-store, private", "x-request-id": requestId },
    });
  } catch {
    dependencies.log({ requestId, status: "provider-error" });
    return error("VOICE_PROVIDER_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function error(code: RealtimeErrorCode, status: number): Response {
  return Response.json({ error: code }, { status, headers: { "cache-control": "no-store, private" } });
}

/** Content-Length is optional and untrusted, so enforce the actual streamed byte count too. */
async function boundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
