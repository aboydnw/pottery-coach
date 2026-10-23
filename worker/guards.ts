/**
 * Blocks cross-site requests by requiring an Origin header that matches the request's own origin
 * or one of `allowedOrigins`. Access signs the potter in with a cookie, so this is what stops other
 * sites from making requests with their session (CSRF).
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
