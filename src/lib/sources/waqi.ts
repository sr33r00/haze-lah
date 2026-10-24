import type { AqiStation } from "../types";
import { MAX_SENSOR_AGE_MS, getJson, num } from "../util";

// AQICN, the World Air Quality Index Project (https://aqicn.org/json-api/doc/). Official JSON API; needs a free token.
// Its terms forbid redistributing cached or archived data: this is read only inside the page-data build, never archived.
const API = "https://api.waqi.info/v2/map/bounds";
const BOX = { south: 1.15, west: 103.6, north: 1.48, east: 104.1 };
const MAX_AQI = 999; // above this a station is faulty
// NEA's own regional monitors ("North, Singapore" ...): the map already shows NEA's regions, so these would sit on top of them.
const NEA_REGION = /^(North|South|East|West|Central), Singapore$/i;

/** The token AQICN needs (a Vercel env var), or undefined. */
export const waqiToken = () => process.env.WAQI_TOKEN || undefined;

type Entry = { lat?: unknown; lon?: unknown; uid?: unknown; aqi?: unknown; station?: { name?: unknown; time?: unknown } };

/**
 * The stations of a `/map/bounds` answer that reported since `since` (ms), inside Singapore. `aqi` arrives as a
 * string, "-" when the station has no reading; those, stations without coordinates, a name or a time, duplicates and NEA's regional monitors are dropped.
 */
export function parseStations(json: { data?: unknown } | null | undefined, since: number): AqiStation[] {
  const rows = Array.isArray(json?.data) ? (json.data as Entry[]) : [];
  const seen = new Set<number>();
  const out: AqiStation[] = [];
  for (const e of rows) {
    const uid = num(e?.uid);
    const lat = num(e?.lat);
    const lon = num(e?.lon);
    const aqi = num(e?.aqi);
    const raw = typeof e?.station?.name === "string" ? e.station.name.trim() : "";
    if (NEA_REGION.test(raw)) continue;
    const name = raw.replace(/,\s*Singapore$/i, "").trim();
    const t = Date.parse(typeof e?.station?.time === "string" ? e.station.time : "");
    if (uid == null || lat == null || lon == null || aqi == null || !name || !(t >= since) || seen.has(uid)) continue;
    if (aqi < 0 || aqi > MAX_AQI || lat < BOX.south || lat > BOX.north || lon < BOX.west || lon > BOX.east) continue;
    seen.add(uid);
    out.push({ uid, name, lat, lon, aqi: Math.round(aqi), time: new Date(t).toISOString() });
  }
  return out;
}

/** All AQICN stations in Singapore with a recent reading; none without a token. */
export async function fetchAqiStations(): Promise<AqiStation[]> {
  const token = waqiToken();
  if (!token) return [];
  const url = `${API}?latlng=${BOX.south},${BOX.west},${BOX.north},${BOX.east}&networks=all&token=${token}`;
  const json = await getJson<{ status?: string; data?: unknown }>(url);
  // On an error `data` is a message, which is not logged: it can echo the request.
  if (json?.status !== "ok") throw new Error(`api.waqi.info status ${json?.status ?? "missing"}`);
  return parseStations(json, Date.now() - MAX_SENSOR_AGE_MS);
}
