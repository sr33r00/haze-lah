export const SG = { lat: 1.3521, lon: 103.8198 };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Date string YYYY-MM-DD in Singapore time, offset by `days`. */
export function sgDate(days = 0, from = new Date()) {
  const t = new Date(from.getTime() + 8 * 3600_000 + days * 86400_000);
  return t.toISOString().slice(0, 10);
}

/** Normalise any timestamp to an ISO string truncated to the hour, in UTC. */
export function hourKey(t: string | number | Date) {
  const d = new Date(t);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export async function getJson<T>(url: string, init: RequestInit & { revalidate?: number } = {}): Promise<T> {
  const { revalidate = 300, ...rest } = init;
  const get = () =>
    fetch(url, {
      ...rest,
      headers: { "User-Agent": "haze-lah (open-source haze tracker)", ...(rest.headers || {}) },
      next: { revalidate },
      signal: AbortSignal.timeout(15_000),
    });
  let res = await get();
  // data.gov.sg allows 6 anonymous calls per 10 s; wait out the window once.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10_000));
    res = await get();
  }
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json() as Promise<T>;
}

export const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
