import { timingSafeEqual } from "node:crypto";

/** Headers of the answers that must never be kept by a cache. */
export const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the request carries `Authorization: Bearer <secret>`; compared in constant time. */
function authorised(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * For the routes that only the Cloudflare Worker in `workers/nea-refresh` may call: null when the request carries
 * `Authorization: Bearer <REFRESH_SECRET>`, otherwise the 503 or 401 answer to return.
 */
export function refuse(req: Request): Response | null {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) return Response.json({ error: "REFRESH_SECRET is not set" }, { status: 503, headers: NO_STORE });
  if (!authorised(req, secret)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  return null;
}
