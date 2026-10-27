/**
 * A per-IP limiter for the public POST routes: `limited(ip)` records a request and says whether the IP has made more than
 * `perWindow` in the last `windowMs`. Per instance: enough to stop one person flooding a route, not a hard guarantee.
 */
export function createLimiter(windowMs: number, perWindow: number) {
  const recent = new Map<string, number[]>();
  return (ip: string, now = Date.now()) => {
    const times = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
    times.push(now);
    recent.set(ip, times);
    return times.length > perWindow;
  };
}

/** The caller's IP: Cloudflare's own header first, then the first hop of `x-forwarded-for`; "unknown" without either. */
export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
