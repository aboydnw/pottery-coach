import { afterEach, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "./index";
import { sqliteD1 } from "./testing/sqliteD1";

afterEach(() => vi.unstubAllGlobals());

const voiceBody = {
  sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1",
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  clientConfigVersion: "voice-v1",
};

function voiceRequest(extraBody = {}, extraHeaders = {}, origin = "http://localhost") {
  return new Request(`${origin}/api/realtime/session`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify({ ...voiceBody, ...extraBody }),
  });
}

function env(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } })) },
    REALTIME_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    SYNC_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    DB: sqliteD1(),
    VOICE_MODEL: "gpt-realtime-2.1-mini",
    REALTIME_ALLOWED_ORIGINS: "",
    ...overrides,
  } as unknown as Parameters<typeof worker.fetch>[1];
}

const call = (request: Request, bindings = env()) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], bindings);

it("hands non-API requests to the static assets", async () => {
  const bindings = env();
  const response = await call(new Request("https://potterycoach.example/session/live"), bindings);
  expect(await response.text()).toContain("doctype");
  expect(bindings.ASSETS.fetch).toHaveBeenCalledOnce();
});

it("keeps cloud voice disabled until the OpenAI key is configured", async () => {
  const response = await call(new Request("https://potterycoach.example/api/realtime/session", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("rejects unknown API paths and non-POST session requests without touching assets", async () => {
  const bindings = env({ OPENAI_API_KEY: "key" });
  expect((await call(new Request("https://potterycoach.example/api/unknown"), bindings)).status).toBe(404);
  expect((await call(new Request("https://potterycoach.example/api/realtime/session"), bindings)).status).toBe(405);
  expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
});

it("applies the Cloudflare rate limit per client address", async () => {
  const limit = vi.fn(async () => ({ success: false }));
  const bindings = env({ OPENAI_API_KEY: "key", REALTIME_RATE_LIMITER: { limit } });
  const response = await call(
    new Request("http://localhost/api/realtime/session", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "cf-connecting-ip": "203.0.113.4",
        "content-type": "application/json",
      },
      body: "{}",
    }),
    bindings,
  );
  expect(response.status).toBe(429);
  expect(limit).toHaveBeenCalledWith({ key: "203.0.113.4" });
});

it("only starts voice for a signed-in potter", async () => {
  const bindings = env({
    OPENAI_API_KEY: "key",
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
    ACCESS_POLICY_AUD: "aud",
  });
  const response = await call(
    new Request("https://potterycoach.example/api/realtime/session", {
      method: "POST",
      headers: { origin: "https://potterycoach.example", "content-type": "application/json" },
      body: "{}",
    }),
    bindings,
  );
  expect(response.status).toBe(401);
});

it("syncs the throw log for the signed-in potter", async () => {
  const sync = (body: unknown, url = "http://localhost/api/sync") =>
    call(
      new Request(url, {
        method: "POST",
        headers: { origin: new URL(url).origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const response = await sync({ since: 0, pieces: [{ id: "p1", updatedAtMs: 1 }], notes: [] });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ pieces: [{ id: "p1" }] });
  expect((await sync({ since: 0, pieces: [], notes: [] }, "https://potterycoach.example/api/sync")).status).toBe(401);
});

it("rejects a valid non-admin request by default without provider access", async () => {
  const provider = vi.fn();
  vi.stubGlobal("fetch", provider);
  const response = await call(voiceRequest(), env({ OPENAI_API_KEY: "test-key" }));
  expect(response.status).toBe(503);
  expect(provider).not.toHaveBeenCalled();
});

it("ignores forged admin and paid identities from the body and headers", async () => {
  const provider = vi.fn(async () => new Response("v=0 answer"));
  vi.stubGlobal("fetch", provider);
  const bindings = env({
    OPENAI_API_KEY: "test-key",
    VOICE_ADMISSION_MODE: "limited-preview",
    VOICE_ADMIN_USER_IDS: "owner@example.test",
  });
  const forged = () =>
    voiceRequest(
      { userId: "owner@example.test", tier: "paid", admin: true, credits: 1000000 },
      { "x-user-id": "owner@example.test", "cf-access-authenticated-user-email": "owner@example.test" },
    );
  expect((await call(forged(), bindings)).status).toBe(200);
  expect((await call(forged(), bindings)).status).toBe(429);
  expect(provider).toHaveBeenCalledOnce();
});

it("keeps a real ledger reservation after provider failure", async () => {
  const provider = vi.fn(async () => new Response("error", { status: 500 }));
  vi.stubGlobal("fetch", provider);
  const bindings = env({ OPENAI_API_KEY: "test-key", VOICE_ADMISSION_MODE: "limited-preview" });
  expect((await call(voiceRequest(), bindings)).status).toBe(502);
  expect((await call(voiceRequest(), bindings)).status).toBe(429);
  expect(provider).toHaveBeenCalledOnce();
});

it("lets the verified owner bypass personal quotas but not the site-wide cap or stop", async () => {
  const team = `https://test-${crypto.randomUUID()}.cloudflareaccess.com`;
  const audience = "voice-test";
  const pair = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" };
  const token = await new SignJWT({ email: "Owner@Example.Test" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(team)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pair.privateKey);
  const provider = vi.fn(async (input: string | URL | Request) =>
    String(input).startsWith(team) ? Response.json({ keys: [jwk] }) : new Response("v=0 answer"),
  );
  vi.stubGlobal("fetch", provider);
  const limit = vi.fn(async () => ({ success: false }));
  const bindings = env({
    OPENAI_API_KEY: "test-key",
    ACCESS_TEAM_DOMAIN: team,
    ACCESS_POLICY_AUD: audience,
    VOICE_ADMIN_USER_IDS: "owner@example.test",
    VOICE_ADMISSION_MODE: "owner-only",
    VOICE_GLOBAL_DAILY_START_LIMIT: "5",
    REALTIME_RATE_LIMITER: { limit },
  });
  const request = () => voiceRequest({}, { "cf-access-jwt-assertion": token }, "https://potterycoach.example");
  for (let count = 0; count < 5; count++) expect((await call(request(), bindings)).status).toBe(200);
  expect(limit).not.toHaveBeenCalled();
  const before = provider.mock.calls.length;
  expect((await call(request(), bindings)).status).toBe(429);
  expect(provider.mock.calls).toHaveLength(before);
  expect((await call(request(), { ...bindings, VOICE_ADMISSION_MODE: "off" } as typeof bindings)).status).toBe(503);
  expect(provider.mock.calls).toHaveLength(before);
});

it("blocks provider access when the preview ledger is unavailable", async () => {
  const provider = vi.fn();
  vi.stubGlobal("fetch", provider);
  const bindings = env({
    OPENAI_API_KEY: "test-key",
    VOICE_ADMISSION_MODE: "limited-preview",
    DB: { batch: vi.fn().mockRejectedValue(new Error("unavailable")), prepare: vi.fn() },
  });
  expect((await call(voiceRequest(), bindings)).status).toBe(503);
  expect(provider).not.toHaveBeenCalled();
});
