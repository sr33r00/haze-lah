// The readings archive: every air reading the site shows, kept after the live page moves on. One file per SGT day,
// data/readings/<date>.json, built by scripts/readings.ts. This file holds the pure parts (formats, builders, merges).
// Hours are the clock hour (0 to 23, SGT) of the instant a reading is stamped with, as the sources stamp them: NEA's
// timestamp, the APIMS DATETIME (Malaysian time is the same clock as SGT) and the end of an OpenAQ hour.
import { REGIONS, type Region } from "./bands";
import type { ApimsReading, ApimsRow } from "./sources/apims";
import type { NeaItem } from "./sources/nea";
import type { Location } from "./sources/openaq";
import { num, sgDate, sgHour, sgtTime } from "./util";

export const SOURCES = ["nea", "apims", "openaq"] as const;
export type SourceId = (typeof SOURCES)[number];

/** NEA's series under short keys, with the data.gov.sg reading each one comes from. */
export const NEA_SERIES = {
  psi: "psi_twenty_four_hourly",
  pm25_1h: "pm25_one_hourly",
  pm25_24h: "pm25_twenty_four_hourly",
  pm10_24h: "pm10_twenty_four_hourly",
  o3_8h: "o3_eight_hour_max",
  co_8h: "co_eight_hour_max",
  so2_24h: "so2_twenty_four_hourly",
  no2_1h: "no2_one_hour_max",
  sub_pm25: "pm25_sub_index",
  sub_pm10: "pm10_sub_index",
  sub_o3: "o3_sub_index",
  sub_so2: "so2_sub_index",
  sub_co: "co_sub_index",
} as const;
export type NeaKey = keyof typeof NEA_SERIES;

/** NEA for the day: `hours` lists the hours served; each series has one row per hour, one value per region (in `regions` order). */
export type NeaPart = { regions: Region[]; hours: number[] } & Record<NeaKey, (number | null)[][]>;

/** The readings of an APIMS station-hour, in this order. */
export const APIMS_KEYS = ["api", "pm25", "pm10", "o3", "co", "so2", "no2"] as const satisfies readonly (keyof ApimsReading)[];

/** One station-hour's values in `APIMS_KEYS` order (null where the station has none). */
type ApimsValues = (number | null)[];

/** APIMS stations for the day: who they are, and per station its 24 hours (index = hour), each the values or null if not captured. */
export type ApimsPart = {
  keys: typeof APIMS_KEYS;
  stations: Record<string, { name: string; state: string; lat: number; lon: number }>;
  hours: Record<string, (ApimsValues | null)[]>;
};

/** Community sensors for the day: their locations, and per location its 24 hours (index = hour) of PM2.5 average, null if none. */
export type OpenAqPart = {
  sensors: Record<string, { name: string; lat: number; lon: number }>;
  hours: Record<string, (number | null)[]>;
};

export type ReadingsDay = {
  v: 1;
  /** SGT date. */
  date: string;
  nea?: NeaPart;
  apims?: ApimsPart;
  openaq?: OpenAqPart;
  /** Why a source has nothing for the day, or only part of it. Never zeros. */
  missing?: Partial<Record<SourceId, string>>;
};

/** What the capture run keeps for a day until the daily run adds it to the day's file. */
export type PendingDay = {
  v: 1;
  date: string;
  apims: ApimsPart;
  /** The newest reading's stamp (ms), and the newest one already committed. */
  latest: number;
  flushed: number;
};

export type ReadingsIndex = { updated: string; days: { date: string; sources: SourceId[]; missing: SourceId[] }[] };

const emptyDay = <T>(): (T | null)[] => Array.from({ length: 24 }, () => null);

const r1 = (v: number) => Math.round(v * 10) / 10;
const rnd = (v: number | null) => (v == null ? null : r1(v));

/** The SGT date and clock hour of an instant. */
const stamp = (t: number) => ({ date: sgDate(0, new Date(t)), hour: sgHour(t) });

/**
 * NEA's day from the dated feeds. Hours come from the item timestamps, one row per hour; a series the feed lacks for an
 * hour is null. Null when neither feed has an hour of the day (the caller fails the day).
 */
export function buildNea(feeds: { psi: NeaItem[]; pm25: NeaItem[] }, date: string): NeaPart | null {
  const byHour = new Map<number, NeaItem["readings"]>();
  for (const it of [...feeds.psi, ...feeds.pm25]) {
    const t = Date.parse(it.timestamp);
    if (Number.isNaN(t)) continue;
    const s = stamp(t);
    if (s.date !== date) continue;
    byHour.set(s.hour, { ...byHour.get(s.hour), ...it.readings });
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  if (!hours.length) return null;
  const part = { regions: [...REGIONS], hours } as NeaPart;
  for (const k of Object.keys(NEA_SERIES) as NeaKey[])
    part[k] = hours.map((h) => REGIONS.map((r) => rnd(num(byHour.get(h)?.[NEA_SERIES[k]]?.[r]))));
  return part;
}

/** A station-hour's values in `APIMS_KEYS` order; PM and the gases to 1 decimal, the API to a whole number. */
const apimsValues = (r: ApimsReading) => APIMS_KEYS.map((k) => (k === "api" ? (r.api == null ? null : Math.round(r.api)) : rnd(r[k])));

/** APIMS rows (one latest hour per station) as one part per SGT date of their stamp. Stations with no stamp or no value are left out. */
export function buildApims(rows: ApimsRow[]): Record<string, ApimsPart> {
  const out: Record<string, ApimsPart> = {};
  for (const { station: s, reading } of rows) {
    const t = Date.parse(s.time ?? "");
    const values = apimsValues(reading);
    if (Number.isNaN(t) || values.every((v) => v == null)) continue;
    const { date, hour } = stamp(t);
    const part = (out[date] ??= { keys: APIMS_KEYS, stations: {}, hours: {} });
    part.stations[s.id] = { name: s.name, state: s.state, lat: Math.round(s.lat * 1000) / 1000, lon: Math.round(s.lon * 1000) / 1000 };
    (part.hours[s.id] ??= emptyDay())[hour] = values;
  }
  return out;
}

/** Two APIMS parts united; where both have a station-hour, `b` wins. */
export function mergeApims(a: ApimsPart | undefined, b: ApimsPart): ApimsPart {
  const hours: ApimsPart["hours"] = {};
  for (const id of new Set([...Object.keys(a?.hours ?? {}), ...Object.keys(b.hours)]))
    hours[id] = Array.from({ length: 24 }, (_, h) => b.hours[id]?.[h] ?? a?.hours[id]?.[h] ?? null);
  return { keys: APIMS_KEYS, stations: { ...a?.stations, ...b.stations }, hours };
}

/** Hourly PM2.5 of community sensors (hour ends as UTC instants) as one part per SGT date, for the dates asked for. */
export function buildOpenAq(sensors: { loc: Location; hours: { t: string; v: number }[] }[], dates: string[]): Record<string, OpenAqPart> {
  const out: Record<string, OpenAqPart> = {};
  for (const { loc, hours } of sensors)
    for (const { t, v } of hours) {
      const { date, hour } = stamp(Date.parse(t));
      if (!dates.includes(date)) continue;
      const part = (out[date] ??= { sensors: {}, hours: {} });
      part.sensors[loc.id] = { name: loc.name, lat: Math.round(loc.lat * 1000) / 1000, lon: Math.round(loc.lon * 1000) / 1000 };
      (part.hours[loc.id] ??= emptyDay())[hour] = r1(v);
    }
  return out;
}

/** `day` with an APIMS part united with the one it has (the new part wins where both have a station-hour); APIMS is then no longer missing. */
export function foldApims(day: ReadingsDay, part: ApimsPart): ReadingsDay {
  const next: ReadingsDay = { ...day, apims: mergeApims(day.apims, part) };
  if (day.missing) {
    const missing = { ...day.missing };
    delete missing.apims;
    if (Object.keys(missing).length) next.missing = missing;
    else delete next.missing;
  }
  return next;
}

/**
 * The day's file from what this run built and the file already there. NEA is replaced. APIMS (captured live, never history)
 * is united with what the file already holds. OpenAQ is replaced when this run has it, otherwise kept. A source with nothing
 * is listed in `missing` with its reason from `notes` (else a default); a note on an OpenAQ part this run built marks it partial.
 */
export function assembleDay(
  date: string,
  built: { nea: NeaPart; apims?: ApimsPart; openaq?: OpenAqPart },
  notes: Partial<Record<SourceId, string>>,
  existing?: ReadingsDay,
): ReadingsDay {
  const openaq = built.openaq ?? existing?.openaq;
  const missing: NonNullable<ReadingsDay["missing"]> = {};
  if (notes.nea) missing.nea = notes.nea;
  if (!existing?.apims && !built.apims) missing.apims = notes.apims ?? "not captured: APIMS serves only its latest hour";
  if (!openaq) missing.openaq = notes.openaq ?? "no readings";
  else if (built.openaq && notes.openaq) missing.openaq = notes.openaq;
  const day: ReadingsDay = { v: 1, date, nea: built.nea, ...(existing?.apims ? { apims: existing.apims } : {}), ...(openaq ? { openaq } : {}) };
  if (Object.keys(missing).length) day.missing = missing;
  return built.apims ? foldApims(day, built.apims) : day;
}

/** The index with `day` added, replacing the entry of the same date; dates stay sorted. `updated` is `now`. */
export function addToReadingsIndex(index: ReadingsIndex, day: ReadingsDay, now = new Date()): ReadingsIndex {
  const sources = SOURCES.filter((s) => day[s]);
  const entry = { date: day.date, sources, missing: SOURCES.filter((s) => !day[s]) };
  const days = [...index.days.filter((d) => d.date !== day.date), entry].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { updated: now.toISOString(), days };
}

/** A pending capture day with `part` added. `flushed` is kept, `latest` moves to the newest stamp seen. */
export function addToPending(pending: PendingDay | undefined, date: string, part: ApimsPart): PendingDay {
  const stamps = Object.values(part.hours).flatMap((h) => h.flatMap((v, hour) => (v ? [sgtTime(date, hour)] : [])));
  return {
    v: 1,
    date,
    apims: mergeApims(pending?.apims, part),
    latest: Math.max(pending?.latest ?? 0, ...stamps),
    flushed: pending?.flushed ?? 0,
  };
}

/**
 * Whether a pending day should be committed now: at least `everyMs` of readings are uncommitted, or the day is over and
 * has any. Commits stay a few a day; the hours in between wait in the workflow's cache.
 */
export function flushDue(p: PendingDay, today: string, everyMs: number): boolean {
  if (p.latest <= p.flushed) return false;
  return p.date < today || p.latest - p.flushed >= everyMs;
}
