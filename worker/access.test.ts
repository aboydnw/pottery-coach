import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { DEV_IDENTITY, identify } from "./access";

const TEAM = "https://pottery.cloudflareaccess.com";
const AUD = "app-audience";
let privateKey: CryptoKey;
let getKey: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  getKey = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" }] });
});

function token(claims: Record<string, unknown> = {}, { audience = AUD, issuer = TEAM } = {}) {
  return new SignJWT({ email: "Anthony@Example.com", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

function request(jwt?: string, url = "https://potterycoach.example/api/sync") {
  return new Request(url, { headers: jwt ? { "cf-access-jwt-assertion": jwt } : {} });
}

describe("identify", () => {
  const config = { teamDomain: TEAM, audience: AUD };

  it("signs in the potter from a valid Access token, by lower-cased email", async () => {
    await expect(identify(request(await token()), config, () => getKey)).resolves.toEqual({
      userId: "anthony@example.com",
    });
  });

  it("rejects missing, wrong-audience, wrong-issuer and email-less tokens", async () => {
    for (const jwt of [
      undefined,
      await token({}, { audience: "other-app" }),
      await token({}, { issuer: "https://evil.cloudflareaccess.com" }),
      await token({ email: undefined }),
      "not-a-token",
    ]) {
      await expect(identify(request(jwt), config, () => getKey)).resolves.toBeNull();
    }
  });

  it("uses the development user only on localhost when Access isn't configured", async () => {
    await expect(identify(request(undefined, "http://localhost:4173/api/sync"), {})).resolves.toEqual(DEV_IDENTITY);
    await expect(identify(request(undefined), {})).resolves.toBeNull();
  });
});
