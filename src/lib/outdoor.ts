import { REGION_POINT, type Region } from "./bands";
import { fmtHour, fmtTime } from "./format";
import { WHO_UV_URL } from "./links";
import type { LightningFeed, OutdoorFeeds, Strike, UvFeed } from "./types";
import { haversineKm, sgNight } from "./util";

/** Lightning counts strikes this close to the region's point (km), within this long (ms). */
export const LIGHTNING_RADIUS_KM = 15;
export const LIGHTNING_WINDOW_MS = 30 * 60_000;
/** A lightning observation older than this (ms) is a stalled feed, and "none nearby" would not be true; likewise heat (WBGT is every 15 minutes). */
const LIGHTNING_MAX_AGE_MS = 20 * 60_000;
const HEAT_MAX_AGE_MS = 60 * 60_000;

/** The first UV index WHO calls Very high. */
export const UV_VERY_HIGH = 8;
/** Where the UV categories come from, for the places that show them. */
export const UV_SOURCES = [["WHO, Global Solar UV Index", WHO_UV_URL]] as const;

/** WHO Global Solar UV Index category: 0 to 2 Low, 3 to 5 Moderate, 6 to 7 High, 8 to 10 Very high, 11 and over Extreme. */
export function uvCategory(index: number): string {
  const v = Math.round(index);
  return v < 3 ? "Low" : v < 6 ? "Moderate" : v < 8 ? "High" : v < 11 ? "Very high" : "Extreme";
}

/** The item nearest to a [lat, lon] point, or null for none. */
export function nearest<T extends { lat: number; lon: number }>(items: T[], point: readonly [number, number]): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const it of items) {
    const km = haversineKm(point[0], point[1], it.lat, it.lon);
    if (km < bestKm) [best, bestKm] = [it, km];
  }
  return best;
}

/** Strikes within the radius of a point and the window before `now`: how many, the nearest (km) and the latest (ms). */
export function lightningNear(strikes: Strike[], point: readonly [number, number], now: number) {
  const near = strikes
    .filter((s) => s.t <= now + 60_000 && now - s.t <= LIGHTNING_WINDOW_MS)
    .map((s) => ({ t: s.t, km: haversineKm(point[0], point[1], s.lat, s.lon) }))
    .filter((s) => s.km <= LIGHTNING_RADIUS_KM);
  return { count: near.length, nearestKm: near.length ? Math.min(...near.map((s) => s.km)) : null, latest: near.length ? Math.max(...near.map((s) => s.t)) : null };
}

/** One cell of the card: the main text and a muted line, or null when its source has no usable answer. `warn` marks lightning nearby. */
export type OutdoorCell = { value: string; sub: string; warn?: boolean } | null;

const rainCell = (feed: OutdoorFeeds["rain"], point: readonly [number, number], now: number): OutdoorCell => {
  const area = feed && now <= Date.parse(feed.end) ? nearest(feed.areas, point) : null;
  return area && feed ? { value: area.forecast, sub: `${area.name} · till ${fmtHour(feed.end)}` } : null;
};

const heatCell = (feed: OutdoorFeeds["heat"], point: readonly [number, number], now: number): OutdoorCell => {
  const st = feed && now - Date.parse(feed.time) <= HEAT_MAX_AGE_MS ? nearest(feed.stations, point) : null;
  return st && feed ? { value: `${st.stress} · ${st.wbgt.toFixed(1)}°`, sub: `${st.town} · ${fmtTime(feed.time)}` } : null;
};

/** The newest UV reading with its WHO category; at night, when the last reading is 0 or there is none yet, just "Night". */
const uvCell = (feed: UvFeed | null, now: number): OutdoorCell => {
  if (!feed) return null;
  const last = feed.readings[0];
  if (sgNight(now) && (!last || last.value === 0)) return { value: "Night", sub: last ? `Last reading ${fmtHour(last.hour)}` : "No reading until morning" };
  return last ? { value: `${Math.round(last.value)} · ${uvCategory(last.value)}`, sub: `Island-wide · ${fmtHour(last.hour)}` } : null;
};

const lightningCell = (feed: LightningFeed | null, point: readonly [number, number], now: number): OutdoorCell => {
  if (!feed || now - Date.parse(feed.time) > LIGHTNING_MAX_AGE_MS) return null;
  const { count, nearestKm, latest } = lightningNear(feed.strikes, point, now);
  if (!count || nearestKm == null || latest == null) return { value: "None nearby", sub: `Within ${LIGHTNING_RADIUS_KM} km · last 30 min` };
  return { value: `${count} ${count === 1 ? "strike" : "strikes"} nearby`, sub: `Nearest ${Math.max(1, Math.round(nearestKm))} km · ${fmtTime(latest)}`, warn: true };
};

/** The four cells of the Outdoor conditions card for a region, as of `now` (ms). A feed that is missing or stale gives null. */
export function outdoorCells(feeds: OutdoorFeeds, region: Region, now: number) {
  const point = REGION_POINT[region];
  return { rain: rainCell(feeds.rain, point, now), heat: heatCell(feeds.heat, point, now), uv: uvCell(feeds.uv, now), lightning: lightningCell(feeds.lightning, point, now) };
}
