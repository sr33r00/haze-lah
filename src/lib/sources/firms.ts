import { unstable_cache } from "next/cache";
import type { Fire, FireSummary } from "../types";

// NASA FIRMS VIIRS active fires. Needs a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/
const BBOX = "95,-6.5,120,7.5"; // west,south,east,north: Sumatra, Peninsula, Borneo

type Area = "sumatra" | "borneo" | "peninsula";

export function classify(lat: number, lon: number): Area | null {
  if (lon >= 108.5 && lon <= 119.5 && lat >= -4.5 && lat <= 7.5) return "borneo";
  const peninsula = lon > 99.6 && lon < 105 && lat < 7 && lat > 4.5 - 0.854 * (lon - 99.5);
  if (peninsula) return "peninsula";
  if (lon >= 95 && lon <= 106.5 && lat >= -6.2 && lat <= 6) return "sumatra";
  return null;
}

const SPAN = 5; // days requested (the area API allows 1 to 5); the map and counts use the last `days`
const AREAS: Area[] = ["sumatra", "borneo", "peninsula"];
/** Compact fire: lat, lon, frp, epoch ms, index in AREAS, confidence. */
type Row = [number, number, number, number, number, string];

/**
 * The 5-day CSV is over 2 MB, above Next's fetch cache limit, so it is fetched uncached and only the parsed rows,
 * a fraction of the size, are cached.
 */
const cachedRows = unstable_cache(
  async (key: string, source: string): Promise<Row[]> => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${BBOX}/${SPAN}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const lines = (await res.text()).trim().split("\n");
    const head = lines[0].split(",");
    const iLat = head.indexOf("latitude");
    const iLon = head.indexOf("longitude");
    const iFrp = head.indexOf("frp");
    const iConf = head.indexOf("confidence");
    const iDate = head.indexOf("acq_date");
    const iTime = head.indexOf("acq_time");
    if (iLat < 0 || iLon < 0) throw new Error(`FIRMS: unexpected response`);
    const rows: Row[] = [];
    for (const line of lines.slice(1)) {
      const c = line.split(",");
      const conf = c[iConf] ?? "";
      if (conf === "l" || conf === "low") continue;
      const lat = parseFloat(c[iLat]);
      const lon = parseFloat(c[iLon]);
      const where = classify(lat, lon);
      if (!where) continue;
      const t = (c[iTime] ?? "0000").padStart(4, "0");
      rows.push([lat, lon, parseFloat(c[iFrp]) || 0, Date.parse(`${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`), AREAS.indexOf(where), conf]);
    }
    return rows;
  },
  ["firms-rows"],
  { revalidate: 1800 },
);

/** Every fire of the last `SPAN` days, except low-confidence ones and those outside the three areas; null without a key. */
export async function fetchFirePoints(): Promise<(Fire & { where: Area })[] | null> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return null;
  const rows = await cachedRows(key, process.env.FIRMS_SOURCE || "VIIRS_SNPP_NRT");
  return rows.map(([lat, lon, frp, t, a, confidence]) => ({ lat, lon, frp, confidence, where: AREAS[a], time: new Date(t).toISOString().slice(0, 19) + "Z" }));
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
