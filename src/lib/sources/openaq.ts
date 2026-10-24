import type { Sensor } from "../types";
import { MAX_SENSOR_AGE_MS, getJson, num } from "../util";

// OpenAQ v3 (https://explore.openaq.org/register). Singapore bounding box: lon/lat min, lon/lat max.
const API = "https://api.openaq.org/v3";
const BBOX = "103.6,1.15,104.1,1.48";

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

/** A sensor value the site shows; anything else is a faulty sensor. */
export const validPm25 = (v: number | null): v is number => v != null && v >= 0 && v <= 1000;

/** Fixed low-cost PM2.5 locations that reported since `since` (ms). Reference monitors (shown from NEA) and calibration/NASA entries are dropped. */
export function pickLocations(json: { results?: Loc[] }, since: number): Location[] {
  const out: Location[] = [];
  for (const l of json.results ?? []) {
    const name = (l.name ?? "").trim();
    const sensorId = l.sensors?.find((s) => s.parameter?.name === "pm25")?.id;
    const lat = num(l.coordinates?.latitude);
    const lon = num(l.coordinates?.longitude);
    const t = Date.parse(l.datetimeLast?.utc ?? "");
    if (l.id == null || !name || sensorId == null || lat == null || lon == null) continue;
    if (l.isMobile || l.isMonitor || /NASA|Calib/i.test(name) || !(t >= since)) continue;
    out.push({ id: l.id, name, lat, lon, sensorId });
  }
  return out;
}

/** The key OpenAQ needs (a Worker secret and a GitHub secret), or undefined. */
export const openaqKey = () => process.env.OPENAQ_API_KEY || undefined;

const auth = (key: string) => ({ headers: { "X-API-Key": key } });

/** The low-cost PM2.5 locations in Singapore that reported since `since` (ms). */
export async function fetchPm25Locations(key: string, since: number): Promise<Location[]> {
  return pickLocations(await getJson(`${API}/locations?bbox=${BBOX}&limit=100`, auth(key)), since);
}

type Hours = { results?: { value?: unknown; period?: { datetimeFrom?: { utc?: string }; datetimeTo?: { utc?: string } } }[] };

/** The hours of a `/sensors/{id}/hours` answer as the UTC instant each hour ends and its average, valid values only. */
export function parseHours(json: Hours): { t: string; v: number }[] {
  const out: { t: string; v: number }[] = [];
  for (const r of json.results ?? []) {
    const v = num(r.value);
    const end = Date.parse(r.period?.datetimeTo?.utc ?? "");
    const start = Date.parse(r.period?.datetimeFrom?.utc ?? "");
    const t = Number.isNaN(end) ? start + 3600_000 : end;
    if (validPm25(v) && !Number.isNaN(t)) out.push({ t: new Date(t).toISOString(), v });
  }
  return out;
}

/** One sensor's hourly PM2.5 averages over a stretch of time (ms), as `parseHours` reads them. OpenAQ serves past hours. */
export async function fetchSensorHours(key: string, sensorId: number, from: number, to: number) {
  const q = `datetime_from=${new Date(from).toISOString()}&datetime_to=${new Date(to).toISOString()}&limit=1000`;
  return parseHours(await getJson<Hours>(`${API}/sensors/${sensorId}/hours?${q}`, auth(key)));
}

export async function fetchCommunitySensors(): Promise<Sensor[]> {
  const key = openaqKey();
  if (!key) return [];
  const init = auth(key);
  const locs = await fetchPm25Locations(key, Date.now() - MAX_SENSOR_AGE_MS);
  const latest = await Promise.allSettled(locs.map((l) => getJson<Latest>(`${API}/locations/${l.id}/latest`, init)));
  const out: Sensor[] = [];
  latest.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const { name, lat, lon, sensorId } = locs[i];
    const m = r.value.results?.find((x) => x.sensorsId === sensorId);
    const v = num(m?.value);
    const t = Date.parse(m?.datetime?.utc ?? "");
    if (!validPm25(v) || Number.isNaN(t)) return;
    out.push({ name, lat, lon, pm25: Math.round(v), time: new Date(t).toISOString() });
  });
  return out;
}
