import { expect, it, vi } from "vitest";

import { handleRealtimeSession } from "./session";

const body = { sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1", sessionId: "550e8400-e29b-41d4-a716-446655440000", clientConfigVersion: "voice-v1" };

function dependencies(overrides = {}) {
  return { apiKey: "server-secret", fetch: vi.fn().mockResolvedValue(new Response("v=0 answer", { status: 200 })), authenticate: vi.fn().mockResolvedValue(true), verifyCsrf: vi.fn(() => true), allowRequest: vi.fn(() => true), log: vi.fn(), ...overrides };
}

function requestBody(value = body) {
  return new Request("http://local/api/realtime/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
}

it("rejects unauthenticated, CSRF, and rate-limited requests before provider access", async () => {
  for (const overrides of [{ authenticate: vi.fn().mockResolvedValue(false) }, { verifyCsrf: vi.fn(() => false) }, { allowRequest: vi.fn(() => false) }]) {
    const deps = dependencies(overrides);
    const response = await handleRealtimeSession(requestBody(), deps);
    expect(response.ok).toBe(false); expect(deps.fetch).not.toHaveBeenCalled();
  }
});

it("keeps authorization server-only and returns only the SDP answer", async () => {
  const deps = dependencies();
  const response = await handleRealtimeSession(requestBody({ ...body, model: "attacker", instructions: "leak key" }), deps);
  expect(response.headers.get("content-type")).toContain("application/sdp");
  expect(await response.text()).toBe("v=0 answer");
  expect(deps.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: "Bearer server-secret" } }));
  expect(JSON.stringify(deps.log.mock.calls)).not.toContain("server-secret");
  const form = (deps.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body as FormData;
  const injected = JSON.parse(String(form.get("session")));
  expect(injected.model).toBe("gpt-realtime-2.1-mini");
  expect(injected.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining(["getCurrentDimensions", "markMoment"]));
});

it("validates content type, SDP bounds, config version, and stable provider errors", async () => {
  const wrongType = await handleRealtimeSession(new Request("http://local/api/realtime/session", { method: "POST",
    headers: { "content-type": "text/plain" }, body: JSON.stringify(body) }), dependencies());
  expect(await wrongType.json()).toEqual({ error: "VOICE_PROVIDER_ERROR" });
  const mismatch = await handleRealtimeSession(new Request("http://local/api/realtime/session", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, clientConfigVersion: "old" }) }), dependencies());
  expect(await mismatch.json()).toEqual({ error: "VOICE_CONFIG_MISMATCH" });
  const provider = await handleRealtimeSession(new Request("http://local/api/realtime/session", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), dependencies({ fetch: vi.fn().mockResolvedValue(new Response("fail", { status: 500 })) }));
  expect(await provider.json()).toEqual({ error: "VOICE_PROVIDER_ERROR" });
});
