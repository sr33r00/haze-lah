import type { Fire, FireSummary } from "../types";

// NASA FIRMS VIIRS active fires. Needs a free MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/
const BBOX = "95,-6.5,120,7.5"; // west,south,east,north: Sumatra, Peninsula, Borneo

export function classify(lat: number, lon: number): "sumatra" | "borneo" | "peninsula" | null {
  if (lon >= 108.5 && lon <= 119.5 && lat >= -4.5 && lat <= 7.5) return "borneo";
  const peninsula = lon > 99.6 && lon < 105 && lat < 7 && lat > 4.5 - 0.854 * (lon - 99.5);
  if (peninsula) return "peninsula";
  if (lon >= 95 && lon <= 106.5 && lat >= -6.2 && lat <= 6) return "sumatra";
  return null;
}

export async function fetchFires(days = 2): Promise<FireSummary> {
  const key = process.env.FIRMS_MAP_KEY;
  const empty: FireSummary = { available: false, days, sumatra: 0, borneo: 0, peninsula: 0, points: [] };
  if (!key) return { ...empty, reason: "FIRMS_MAP_KEY not set" };
  const source = process.env.FIRMS_SOURCE || "VIIRS_SNPP_NRT";
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${BBOX}/${days}`;
  const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  const head = lines[0].split(",");
  const iLat = head.indexOf("latitude");
  const iLon = head.indexOf("longitude");
  const iFrp = head.indexOf("frp");
  const iConf = head.indexOf("confidence");
  const iDate = head.indexOf("acq_date");
  const iTime = head.indexOf("acq_time");
  if (iLat < 0 || iLon < 0) throw new Error(`FIRMS: unexpected response`);
  const s: FireSummary = { ...empty, available: true };
  const pts: Fire[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const conf = c[iConf] ?? "";
    if (conf === "l" || conf === "low") continue;
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    const where = classify(lat, lon);
    if (!where) continue;
    s[where]++;
    const t = (c[iTime] ?? "0000").padStart(4, "0");
    pts.push({ lat, lon, frp: parseFloat(c[iFrp]) || 0, confidence: conf, time: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z` });
  }
  // Keep the strongest fires for the map so the page stays light.
  s.points = pts.sort((a, b) => b.frp - a.frp).slice(0, 600);
  return s;
}
