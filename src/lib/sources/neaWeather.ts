import type { HeatFeed, HeatStation, LightningFeed, OutdoorFeeds, RainFeed, Strike, TempFeed, UvFeed } from "../types";
import { getJson, num, sgDate } from "../util";
import { BASE, headers } from "./nea";

// NEA real-time weather via data.gov.sg (Singapore Open Data Licence): 2-hour forecast, WBGT heat stress, air temperature, UV index and lightning.
// The parse functions are pure and throw when a feed has nothing usable, so one failed source never shows a wrong value.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
/** A timestamp as ms, or null when it is not one. */
const ms = (v: unknown): number | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
/** The `records` array of a `/weather?api=` answer. */
const records = (json: unknown): Obj[] => arr(obj(obj(json)?.data)?.records).map(obj).filter((r): r is Obj => r != null);

/** NEA's 2-hour forecast: each town's forecast joined to its label point. */
export function parseRain(json: unknown): RainFeed {
  const data = obj(obj(json)?.data);
  const item = obj(arr(data?.items)[0]);
  const period = obj(item?.valid_period);
  const start = str(period?.start);
  const end = str(period?.end);
  if (!start || !end) throw new Error("NEA 2-hour forecast: no period");
  const forecasts = new Map<string, string>();
  for (const f of arr(item?.forecasts).map(obj)) {
    const area = str(f?.area);
    const text = str(f?.forecast);
    if (area && text) forecasts.set(area, text);
  }
  const areas = arr(data?.area_metadata).flatMap((a) => {
    const m = obj(a);
    const name = str(m?.name);
    const at = obj(m?.label_location);
    const lat = num(at?.latitude);
    const lon = num(at?.longitude);
    const forecast = name ? forecasts.get(name) : undefined;
    return name && lat != null && lon != null && forecast ? [{ name, lat, lon, forecast }] : [];
  });
  if (!areas.length) throw new Error("NEA 2-hour forecast: no areas");
  return { start, end, areas };
}

/** NEA's WBGT observation: the stations with a position, a reading and a heat stress band. */
export function parseHeat(json: unknown): HeatFeed {
  const rec = records(json)[0];
  const time = str(rec?.datetime);
  if (!time || ms(time) == null) throw new Error("NEA WBGT: no time");
  const stations = arr(obj(rec?.item)?.readings).flatMap((r): HeatStation[] => {
    const o = obj(r);
    const st = obj(o?.station);
    const at = obj(o?.location);
    const id = str(st?.id);
    const lat = num(at?.latitude);
    const lon = num(at?.longitude);
    const wbgt = num(o?.wbgt);
    const stress = str(o?.heatStress);
    if (!id || lat == null || lon == null || wbgt == null || !stress) return [];
    return [{ id, town: str(st?.townCenter) ?? str(st?.name) ?? id, lat, lon, wbgt, stress }];
  });
  if (!stations.length) throw new Error("NEA WBGT: no stations");
  return { time, stations };
}

/** NEA's measured air temperature: the newest minute's readings joined to their stations' positions. */
export function parseTemp(json: unknown): TempFeed {
  const data = obj(obj(json)?.data);
  const rec = obj(arr(data?.readings)[0]);
  const time = str(rec?.timestamp);
  if (!time || ms(time) == null) throw new Error("NEA air temperature: no time");
  const places = new Map<string, { name: string; lat: number; lon: number }>();
  for (const s of arr(data?.stations).map(obj)) {
    const id = str(s?.id);
    const at = obj(s?.location);
    const lat = num(at?.latitude);
    const lon = num(at?.longitude);
    if (id && lat != null && lon != null) places.set(id, { name: str(s?.name) ?? id, lat, lon });
  }
  const stations = arr(rec?.data).flatMap((r) => {
    const o = obj(r);
    const place = places.get(str(o?.stationId) ?? "");
    const temp = num(o?.value);
    return place && temp != null ? [{ ...place, temp }] : [];
  });
  if (!stations.length) throw new Error("NEA air temperature: no stations");
  return { time, stations };
}

/** NEA's UV index readings, newest first. Empty before the first reading of a day. */
export function parseUv(json: unknown): UvFeed {
  const recs = records(json);
  if (!recs.length) throw new Error("NEA UV: no records");
  const readings = recs
    .flatMap((r) => arr(r.index))
    .flatMap((i) => {
      const o = obj(i);
      const hour = str(o?.hour);
      const value = num(o?.value);
      return hour && ms(hour) != null && value != null ? [{ hour, value }] : [];
    })
    .sort((a, b) => Date.parse(b.hour) - Date.parse(a.hour));
  return { readings };
}

/**
 * NEA's lightning observations from one or more answers (several when the window spans midnight). Each record is two minutes; a
 * reading carries a position (`location.latitude` and `longitude`, or `latitude` and `longitude`, text or number) and its own time,
 * else its record's. `type` "C" is cloud-to-cloud; anything else (G, or missing) counts as cloud-to-ground, so no strike is hidden. Anything that
 * cannot be read is skipped, strikes before `since` (ms) dropped and repeats counted once.
 */
export function parseLightning(resps: unknown[], since = 0): LightningFeed {
  const recs = resps.flatMap(records);
  const times = recs.flatMap((r) => ms(r.datetime) ?? []);
  if (!times.length) throw new Error("NEA lightning: no records");
  const seen = new Set<string>();
  const strikes: Strike[] = [];
  for (const r of recs)
    for (const reading of arr(obj(r.item)?.readings)) {
      const o = obj(reading);
      const at = obj(o?.location) ?? o;
      const lat = num(at?.latitude);
      const lon = num(at?.longitude);
      const t = ms(o?.datetime) ?? ms(o?.timestamp) ?? ms(r.datetime);
      if (lat == null || lon == null || t == null || t < since) continue;
      const key = `${t}|${lat}|${lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      strikes.push({ t, lat, lon, ground: str(o?.type)?.trim().toUpperCase() !== "C" });
    }
  return { time: new Date(Math.max(...times)).toISOString(), strikes: strikes.sort((a, b) => b.t - a.t) };
}

/** How long a strike is kept: the card counts the last 30 minutes, and the cache adds up to 5 more. */
const KEEP_STRIKES_MS = 40 * 60_000;

const weather = (api: string, date?: string) => getJson<unknown>(`${BASE}/weather?api=${api}${date ? `&date=${date}` : ""}`, { headers: headers() });

/** Runs one source: its answer, or null (logged) when it fails, so the others still show. */
async function source<T>(name: string, go: () => Promise<T>): Promise<T | null> {
  try {
    return await go();
  } catch (e) {
    console.error(`[haze] ${name}:`, e);
    return null;
  }
}

/**
 * The five feeds, each null when it failed. Lightning is read from the dated feed, which holds the last 25 records (about 50
 * minutes); the undated one holds only the newest. In the first 40 minutes of the SGT day, yesterday's is read as well.
 */
export async function fetchOutdoor(now = Date.now()): Promise<OutdoorFeeds> {
  const today = sgDate(0, new Date(now));
  const early = sgDate(0, new Date(now - KEEP_STRIKES_MS)) !== today;
  const [rain, heat, temp, uv, lightning] = await Promise.all([
    source("NEA 2-hour forecast", async () => parseRain(await getJson<unknown>(`${BASE}/two-hr-forecast`, { headers: headers() }))),
    source("NEA WBGT", async () => parseHeat(await weather("wbgt"))),
    source("NEA air temperature", async () => parseTemp(await getJson<unknown>(`${BASE}/air-temperature`, { headers: headers() }))),
    source("NEA UV", async () => parseUv(await getJson<unknown>(`${BASE}/uv`, { headers: headers() }))),
    source("NEA lightning", async () => {
      const [day, before] = await Promise.all([weather("lightning", today), early ? weather("lightning", sgDate(-1, new Date(now))).catch(() => null) : null]);
      return parseLightning([day, before], now - KEEP_STRIKES_MS);
    }),
  ]);
  return { rain, heat, temp, uv, lightning };
}
