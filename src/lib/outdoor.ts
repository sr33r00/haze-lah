import { REGION_POINT, type Region } from "./bands";
import { fromHour } from "./forecast";
import { fmtHour, fmtTime } from "./format";
import { HEAT_STRESS_URL, WHO_UV_URL } from "./links";
import type { LightningFeed, OutdoorFeeds, Strike, UvFeed, WeatherHour } from "./types";
import { haversineKm, sgNight } from "./util";

/** Lightning counts strikes (and, apart, cloud lightning) this close to the region's point (km), within this long (ms). */
export const LIGHTNING_RADIUS_KM = 15;
export const LIGHTNING_WINDOW_MS = 30 * 60_000;
/** A lightning observation older than this (ms) is a stalled feed, and "none nearby" would not be true; likewise heat (WBGT is every 15 minutes) and air temperature (every minute). */
const LIGHTNING_MAX_AGE_MS = 20 * 60_000;
const HEAT_MAX_AGE_MS = 60 * 60_000;
const TEMP_MAX_AGE_MS = 30 * 60_000;

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

/**
 * Lightning within the radius of a point and the window before `now`. Only cloud-to-ground strikes count: `count`, the nearest (km) and the
 * latest (ms). `cloud` says whether any cloud-to-cloud lightning was also seen there (a storm nearby that has not reached the ground).
 */
export function lightningNear(strikes: Strike[], point: readonly [number, number], now: number) {
  const near = strikes
    .filter((s) => s.t <= now + 60_000 && now - s.t <= LIGHTNING_WINDOW_MS)
    .map((s) => ({ t: s.t, ground: s.ground, km: haversineKm(point[0], point[1], s.lat, s.lon) }))
    .filter((s) => s.km <= LIGHTNING_RADIUS_KM);
  const ground = near.filter((s) => s.ground);
  return {
    count: ground.length,
    nearestKm: ground.length ? Math.min(...ground.map((s) => s.km)) : null,
    latest: ground.length ? Math.max(...ground.map((s) => s.t)) : null,
    cloud: near.some((s) => !s.ground),
  };
}

/** The sources a tile's detail line links to: [name, url]. */
type Links = readonly (readonly [string, string])[];

/**
 * One tile of the weather panel: a big `value` and a one-line `sub`, the `detail` shown when it is tapped, and links for it. `warn` says what
 * turns the warning colour: the `value` (and icon), only the `sub`, only the `icon`, or the whole `tile`. `big` marks a number, set larger than a word.
 * Null when its source has no usable answer.
 */
export type OutdoorCell = { value: string; sub: string; detail: string; big?: boolean; warn?: "value" | "sub" | "icon" | "tile"; links?: Links } | null;

const deg = (n: number) => `${Math.round(n)}°`;

/** NEA's 2-hour forecast text in a word or two that fits a small tile: by keyword, else the text without its bracket. */
export function shortForecast(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("thunder")) return t.includes("heavy") ? "Heavy storms" : "Storms";
  if (t.includes("heavy")) return "Heavy rain";
  if (/rain|shower|drizzle/.test(t)) return t.includes("light") ? "Light rain" : "Rain";
  if (t.includes("cloud")) return t.includes("partly") ? "Partly cloudy" : "Cloudy";
  if (t.includes("haz")) return "Hazy";
  if (/mist|fog/.test(t)) return "Misty";
  if (t.includes("wind")) return "Windy";
  if (/fair|sun|clear/.test(t)) return "Fair";
  return text.replace(/\s*\(.*?\)/g, "").trim();
}

/** The feels-like temperature (°C) of the forecast hour that holds `now`, or null without one. */
export function feelsLikeNow(weather: WeatherHour[], now: number): number | null {
  const hour = fromHour(weather, now)[0];
  return hour && Date.parse(hour.time) <= now ? hour.feelsLike : null;
}

const rainCell = (feed: OutdoorFeeds["rain"], point: readonly [number, number], now: number): OutdoorCell => {
  const area = feed && now <= Date.parse(feed.end) ? nearest(feed.areas, point) : null;
  if (!area || !feed) return null;
  const till = fmtHour(feed.end);
  return { value: shortForecast(area.forecast), sub: `till ${till}`, detail: `${area.forecast} in ${area.name} till ${till}. NEA's 2-hour forecast for the town nearest the middle of the region.` };
};

const heatStation = (feed: OutdoorFeeds["heat"], point: readonly [number, number], now: number) =>
  feed && now - Date.parse(feed.time) <= HEAT_MAX_AGE_MS ? nearest(feed.stations, point) : null;

/**
 * The measured air temperature, with the feels-like of the hour from the forecast. The sub line is the feels-like, or "Heat high" when NEA's
 * WBGT band is High. With no measurement the feels-like stands in as the value; with neither, null.
 */
const tempCell = (feeds: OutdoorFeeds, point: readonly [number, number], now: number, feelsLike: number | null): OutdoorCell => {
  const st = feeds.temp && now - Date.parse(feeds.temp.time) <= TEMP_MAX_AGE_MS ? nearest(feeds.temp.stations, point) : null;
  const heat = heatStation(feeds.heat, point, now);
  const value = st?.temp ?? feelsLike;
  if (value == null) return null;
  const hot = heat != null && /^high/i.test(heat.stress);
  const detail = [
    st && feeds.temp ? `${st.temp.toFixed(1)} °C measured at ${st.name} at ${fmtTime(feeds.temp.time)}.` : null,
    feelsLike != null ? `Feels like ${Math.round(feelsLike)} °C (Open-Meteo model).` : null,
    heat && feeds.heat ? `Heat stress ${heat.stress} · WBGT ${heat.wbgt.toFixed(1)} °C at ${heat.town}. WBGT adds humidity, wind and sun to the air temperature.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const sub = hot ? "Heat high" : !st ? "Feels like" : feelsLike != null ? `Feels ${deg(feelsLike)}` : "Measured";
  return { value: deg(value), sub, detail, big: true, warn: hot ? "sub" : undefined, links: heat ? [["NEA, Heat stress", HEAT_STRESS_URL]] : undefined };
};

const UV_DETAIL = "WHO categories: 0 to 2 Low, 3 to 5 Moderate, 6 to 7 High, 8 to 10 Very high, 11 and over Extreme.";

/** The newest UV reading with its WHO category; at night, when the last reading is 0 or there is none yet, just "Night". */
const uvCell = (feed: UvFeed | null, now: number): OutdoorCell => {
  if (!feed) return null;
  const last = feed.readings[0];
  if (sgNight(now) && (!last || last.value === 0)) return { value: "Night", sub: last ? `Last ${fmtHour(last.hour)}` : "Till morning", detail: `${last ? `The last reading, at ${fmtHour(last.hour)}, was 0.` : "No reading until morning."} ${UV_DETAIL}`, links: UV_SOURCES };
  if (!last) return null;
  return {
    value: String(Math.round(last.value)),
    sub: uvCategory(last.value),
    detail: `UV ${Math.round(last.value)}, ${uvCategory(last.value)}. Island-wide · ${fmtHour(last.hour)}. ${UV_DETAIL}`,
    big: true,
    warn: Math.round(last.value) >= UV_VERY_HIGH ? "value" : undefined,
    links: UV_SOURCES,
  };
};

const lightningCell = (feed: LightningFeed | null, point: readonly [number, number], now: number): OutdoorCell => {
  if (!feed || now - Date.parse(feed.time) > LIGHTNING_MAX_AGE_MS) return null;
  const { count, nearestKm, latest, cloud } = lightningNear(feed.strikes, point, now);
  const within = `within ${LIGHTNING_RADIUS_KM} km`;
  const where = `${within} of the middle of the region in the last 30 minutes`;
  if (count && nearestKm != null && latest != null) {
    const km = Math.max(1, Math.round(nearestKm));
    const strikes = `${count} ${count === 1 ? "strike" : "strikes"}`;
    return { value: strikes, sub: `${km} km`, detail: `${count} cloud-to-ground ${count === 1 ? "strike" : "strikes"} ${where}. Nearest ${km} km at ${fmtTime(latest)}.`, warn: "tile" };
  }
  if (cloud) return { value: "In clouds", sub: "Storm nearby", detail: `No lightning reached the ground ${within} in the last 30 minutes, but NEA detected lightning inside the clouds nearby: a storm is close.`, warn: "icon" };
  return { value: "None", sub: `${LIGHTNING_RADIUS_KM} km`, detail: `NEA detected no lightning ${where}. Checked ${fmtTime(feed.time)}.` };
};

const NO_FEEDS: OutdoorFeeds = { rain: null, heat: null, temp: null, uv: null, lightning: null };

/**
 * The four tiles of the hero's weather panel for a region, as of `now` (ms), with the forecast's `feelsLike` for this hour. A feed that is
 * missing or stale gives null for its tile; `feeds` null (all failed) still shows the feels-like.
 */
export function outdoorCells(feeds: OutdoorFeeds | null, region: Region, now: number, feelsLike: number | null = null) {
  const f = feeds ?? NO_FEEDS;
  const point = REGION_POINT[region];
  return { temp: tempCell(f, point, now, feelsLike), uv: uvCell(f.uv, now), rain: rainCell(f.rain, point, now), lightning: lightningCell(f.lightning, point, now) };
}
