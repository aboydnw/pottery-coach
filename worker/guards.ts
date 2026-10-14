/** Accepts a bearer token only when it matches `expected` using a constant-time comparison. */
export async function hasBearerToken(request: Request, expected: string): Promise<boolean> {
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all(
    [supplied, expected].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  const leftBytes = new Uint8Array(left!);
  const rightBytes = new Uint8Array(right!);
  let difference = supplied.length === 0 ? 1 : 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index]! ^ rightBytes[index]!;
  return difference === 0;
}

/**
 * Blocks cross-site requests by requiring an Origin header that matches the request's own origin
 * or one of `allowedOrigins`. This replaces a CSRF token because the endpoint has no cookie session.
 */
export function isSameOrigin(request: Request, allowedOrigins: readonly string[] = []): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin || allowedOrigins.includes(origin);
}

/** Returns the caller's address as reported by Cloudflare, falling back to a shared bucket. */
export function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") || "unknown";
}
