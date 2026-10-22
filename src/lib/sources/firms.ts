import { unstable_cache } from "next/cache";
import type { Fire, FireSummary } from "../types";
import { parseFirmsCsv, rowToFire, type Area, type Row } from "./firmsCsv";

// NASA FIRMS VIIRS active fires. Needs a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/
const BBOX = "95,-6.5,120,7.5"; // west,south,east,north: Sumatra, Peninsula, Borneo

const SPAN = 5; // days requested (the area API allows 1 to 5); the map and counts use the last `days`
/** The area-API address for `days` UTC days (1 to 5): the latest ones, or those from `from` (YYYY-MM-DD) on. */
const firmsUrl = (key: string, source: string, days: number, from?: string) =>
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${BBOX}/${days}${from ? `/${from}` : ""}`;

/** Fetches one area-API table (uncached) as compact rows. */
async function fetchRows(url: string, timeoutMs = 20_000): Promise<Row[]> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  return parseFirmsCsv(await res.text());
}

/**
 * The 5-day CSV is over 2 MB, above Next's fetch cache limit, so it is fetched uncached and only the parsed rows,
 * a fraction of the size, are cached.
 */
const cachedRows = unstable_cache(
  (key: string, source: string): Promise<Row[]> => fetchRows(firmsUrl(key, source, SPAN)),
  ["firms-rows"],
  { revalidate: 1800 },
);

/** Every fire of the last `SPAN` days, except low-confidence ones and those outside the three areas; null without a key. */
export async function fetchFirePoints(): Promise<(Fire & { where: Area })[] | null> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return null;
  const rows = await cachedRows(key, process.env.FIRMS_SOURCE || "VIIRS_SNPP_NRT");
  return rows.map(rowToFire);
}

/**
 * Fires of the UTC days `from` to `to` (YYYY-MM-DD, inclusive) for the history backfill, 5 days per request, not cached.
 * The product is the live one (`FIRMS_SOURCE`, default VIIRS_SNPP_NRT). NRT keeps only recent months: a request it answers
 * with no fires (the region always has some) is asked again of the standard-processing product, `_SP`, and `log` says so.
 */
export async function fetchFiresRange(key: string, from: string, to: string, log: (m: string) => void = console.log): Promise<(Fire & { where: Area })[]> {
  const nrt = process.env.FIRMS_SOURCE || "VIIRS_SNPP_NRT";
  const sp = nrt.replace(/_NRT$/, "_SP");
  const out: Row[] = [];
  for (let day = Date.parse(from); day <= Date.parse(to); day += SPAN * 86400_000) {
    const start = new Date(day).toISOString().slice(0, 10);
    const days = Math.min(SPAN, Math.round((Date.parse(to) - day) / 86400_000) + 1);
    let rows = await fetchRows(firmsUrl(key, nrt, days, start), 60_000).catch(() => [] as Row[]);
    if (!rows.length && sp !== nrt) {
      rows = await fetchRows(firmsUrl(key, sp, days, start), 60_000);
      log(`FIRMS: ${nrt} had no fires for ${start} (${days} days); used ${sp}${rows.length ? "" : ", which has none either"}`);
    }
    out.push(...rows);
  }
  return out.map(rowToFire);
}

export async function fetchFires(days = 2): Promise<FireSummary> {
  const empty: FireSummary = { available: false, days, sumatra: 0, borneo: 0, peninsula: 0, points: [], daily: [] };
  const all = await fetchFirePoints();
  if (!all) return { ...empty, reason: "FIRMS_MAP_KEY not set" };
  const s: FireSummary = { ...empty, available: true };
  const recent = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const daily = new Map<string, { sumatra: number; borneo: number }>();
  for (let k = SPAN - 1; k >= 0; k--) daily.set(new Date(Date.now() - k * 86400_000).toISOString().slice(0, 10), { sumatra: 0, borneo: 0 });
  const pts: Fire[] = [];
  for (const { where, ...f } of all) {
    const date = f.time.slice(0, 10);
    const d = daily.get(date);
    if (d && where !== "peninsula") d[where]++;
    if (date < recent) continue;
    s[where]++;
    pts.push(f);
  }
  // Keep the strongest fires for the map so the page stays light.
  s.daily = [...daily].map(([date, v]) => ({ date, ...v }));
  s.points = pts.sort((a, b) => b.frp - a.frp).slice(0, 600);
  return s;
}
