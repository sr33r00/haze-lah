import type { Sensor } from "../types";
import { getJson, num } from "../util";

// OpenAQ v3 (https://explore.openaq.org/register). Singapore bounding box: lon/lat min, lon/lat max.
const API = "https://api.openaq.org/v3";
const BBOX = "103.6,1.15,104.1,1.48";
const MAX_AGE_MS = 3 * 3600_000;

type Loc = {
  id?: number;
  name?: string;
  isMobile?: boolean;
  isMonitor?: boolean;
  coordinates?: { latitude?: unknown; longitude?: unknown };
  datetimeLast?: { utc?: string } | null;
  sensors?: { id?: number; parameter?: { name?: string } }[];
};
type Latest = { results?: { value?: unknown; datetime?: { utc?: string }; sensorsId?: number }[] };

export type Location = { id: number; name: string; lat: number; lon: number; sensorId: number };

/** Fixed, recently reporting low-cost PM2.5 locations. Reference monitors (shown from NEA) and calibration/NASA entries are dropped. */
export function pickLocations(json: { results?: Loc[] }, now = Date.now()): Location[] {
  const out: Location[] = [];
  for (const l of json.results ?? []) {
    const name = (l.name ?? "").trim();
    const sensorId = l.sensors?.find((s) => s.parameter?.name === "pm25")?.id;
    const lat = num(l.coordinates?.latitude);
    const lon = num(l.coordinates?.longitude);
    const t = Date.parse(l.datetimeLast?.utc ?? "");
    if (l.id == null || !name || sensorId == null || lat == null || lon == null) continue;
    if (l.isMobile || l.isMonitor || /NASA|Calib/i.test(name) || !(now - t <= MAX_AGE_MS)) continue;
    out.push({ id: l.id, name, lat, lon, sensorId });
  }
  return out;
}

export async function fetchCommunitySensors(): Promise<Sensor[]> {
  const key = process.env.OPENAQ_API_KEY;
  if (!key) return [];
  const init = { revalidate: 900, headers: { "X-API-Key": key } };
  const locs = pickLocations(await getJson(`${API}/locations?bbox=${BBOX}&limit=100`, init));
  const latest = await Promise.allSettled(locs.map((l) => getJson<Latest>(`${API}/locations/${l.id}/latest`, init)));
  const out: Sensor[] = [];
  latest.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const { name, lat, lon, sensorId } = locs[i];
    const m = r.value.results?.find((x) => x.sensorsId === sensorId);
    const v = num(m?.value);
    const t = Date.parse(m?.datetime?.utc ?? "");
    if (v == null || v < 0 || v > 1000 || Number.isNaN(t)) return;
    out.push({ name, lat, lon, pm25: Math.round(v), time: new Date(t).toISOString() });
  });
  return out;
}
