export const SG = { lat: 1.3521, lon: 103.8198 };

/** A community sensor reading older than this (ms) is not shown. */
export const MAX_SENSOR_AGE_MS = 3 * 3600_000;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Date string YYYY-MM-DD in Singapore time, offset by `days`. */
/** Hour of the day in Singapore (0 to 23). */
export const sgHour = (t: string | number | Date = new Date()) => (new Date(t).getUTCHours() + 8) % 24;

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

/** `revalidate`: seconds to keep the answer in the data cache. Default 0 (not kept): fast sources are read only when the
 * 30-minute page data is rebuilt, so keeping them too would only add cache writes. */
type FetchInit = RequestInit & { revalidate?: number; /** ms before giving up on one try; default 15000 */ timeout?: number };

async function getRes(url: string, init: FetchInit): Promise<Response> {
  const { revalidate = 0, timeout = 15_000, ...rest } = init;
  const get = () =>
    fetch(url, {
      ...rest,
      headers: { "User-Agent": "haze-lah (open-source haze tracker)", ...(rest.headers || {}) },
      next: { revalidate },
      signal: AbortSignal.timeout(timeout),
    });
  // One retry when the connection itself fails (a timeout or reset); HTTP errors are handled below.
  let res = await get().catch(async () => {
    await new Promise((r) => setTimeout(r, 1000));
    return get();
  });
  // data.gov.sg allows 6 anonymous calls per 10 s; wait out the window once.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10_000));
    res = await get();
  }
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res;
}

export const getJson = async <T>(url: string, init: FetchInit = {}): Promise<T> => (await getRes(url, init)).json() as Promise<T>;

export const getText = async (url: string, init: FetchInit = {}): Promise<string> => (await getRes(url, init)).text();

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
