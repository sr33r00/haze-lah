import { aqiToPm25 } from "../aqi";
import type { Sensor } from "../types";
import { getJson, num } from "../util";

// World Air Quality Index Project (https://aqicn.org/data-platform/token). Singapore bounding box.
const BOUNDS = "1.15,103.6,1.48,104.1";
const MAX_AGE_MS = 3 * 3600_000;

type Resp = { status?: string; data?: unknown };
type Entry = { lat?: unknown; lon?: unknown; aqi?: unknown; station?: { name?: unknown; time?: unknown } };

// NEA's five regions and Malaysian DOE stations are already shown from their own sources.
const NEA_REGION = /^(north|south|east|west|central), singapore$/i;

/** Turn a WAQI map/bounds response into community sensors; drops duplicates, calibration entries, missing and stale readings. */
export function parseWaqi(json: Resp, now = Date.now()): Sensor[] {
  if (json.status !== "ok" || !Array.isArray(json.data)) throw new Error(`WAQI: ${typeof json.data === "string" ? json.data : "bad response"}`);
  const out: Sensor[] = [];
  for (const e of json.data as Entry[]) {
    const name = String(e.station?.name ?? "").trim();
    if (!name || NEA_REGION.test(name) || /malaysia|nasa gsfc/i.test(name)) continue;
    const aqi = num(e.aqi); // "-" means no data
    const lat = num(e.lat);
    const lon = num(e.lon);
    const t = Date.parse(String(e.station?.time));
    if (aqi == null || lat == null || lon == null || !(now - t <= MAX_AGE_MS)) continue;
    const pm25 = aqiToPm25(aqi);
    if (pm25 == null) continue;
    out.push({ name, lat, lon, pm25: Math.round(pm25), time: new Date(t).toISOString() });
  }
  return out;
}

export async function fetchCommunitySensors(): Promise<Sensor[]> {
  const token = process.env.WAQI_TOKEN;
  if (!token) return [];
  const j = await getJson<Resp>(`https://api.waqi.info/v2/map/bounds?latlng=${BOUNDS}&networks=all&token=${encodeURIComponent(token)}`, { revalidate: 900 });
  return parseWaqi(j);
}
