import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type Identity = { userId: string };

export type AccessConfig = {
  /** e.g. `https://yourteam.cloudflareaccess.com`; unset means Access isn't configured. */
  teamDomain?: string;
  /** The Access application's audience (AUD) tag. */
  audience?: string;
};

/** Used only on localhost when Access isn't configured, so local development and tests work. */
export const DEV_IDENTITY: Identity = { userId: "dev@localhost" };
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const keySets = new Map<string, JWTVerifyGetKey>();

/**
 * Who is making this request, from the token Cloudflare Access adds after the potter signs in.
 * Fails closed: without a valid token (or Access configuration) nobody is signed in, except the
 * fixed development user on localhost.
 */
export async function identify(
  request: Request,
  config: AccessConfig,
  getKey: (teamDomain: string) => JWTVerifyGetKey = remoteKeys,
): Promise<Identity | null> {
  const { teamDomain, audience } = config;
  if (!teamDomain || !audience) return LOCAL_HOSTS.has(new URL(request.url).hostname) ? DEV_IDENTITY : null;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(teamDomain), { issuer: teamDomain, audience });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    return email ? { userId: email } : null;
  } catch {
    return null;
  }
}

function remoteKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = keySets.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keys);
  }
  return keys;
}
