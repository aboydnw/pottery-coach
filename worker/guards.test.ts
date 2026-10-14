import { expect, it } from "vitest";
import { clientAddress, hasBearerToken, isSameOrigin } from "./guards";

const request = (headers: Record<string, string>) =>
  new Request("https://coach.example/api/realtime/session", { method: "POST", headers });

it("accepts only the exact bearer token", async () => {
  expect(await hasBearerToken(request({ authorization: "Bearer field-token" }), "field-token")).toBe(true);
  expect(await hasBearerToken(request({ authorization: "Bearer field-tokeN" }), "field-token")).toBe(false);
  expect(await hasBearerToken(request({}), "field-token")).toBe(false);
});

it("requires a same-origin or explicitly allowed Origin header", () => {
  expect(isSameOrigin(request({ origin: "https://coach.example" }))).toBe(true);
  expect(isSameOrigin(request({ origin: "https://evil.example" }))).toBe(false);
  expect(isSameOrigin(request({}))).toBe(false);
  expect(isSameOrigin(request({ origin: "https://preview.example" }), ["https://preview.example"])).toBe(true);
});

it("keys clients by the address Cloudflare reports", () => {
  expect(clientAddress(request({ "cf-connecting-ip": "203.0.113.4" }))).toBe("203.0.113.4");
  expect(clientAddress(request({}))).toBe("unknown");
});
