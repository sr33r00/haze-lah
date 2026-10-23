import { windFrom } from "./context";
import { fmtDayHour } from "./format";
import type { Ahead, Fire, Journey, Replay, ReplayDay, SmokeGrid } from "./types";
import { SG, sgDate, sgtTime } from "./util";
import { backTrail, forwardTrail, sample, type WindFrame } from "./wind";

const DAYS = 5; // FIRMS keeps 5 days, so the replay goes back that far
export const ARRIVAL_SGT = 14; // trace the air that reached Singapore at 2pm each day
const WINDOW_H = 72; // how far back the trail goes, and which fires count as "passed"
const NEAR_KM = 50;
/** Fires a live replay day keeps (the strongest). */
export const MAP_FIRES = 400;
const START_MAX_KM = 400; // a trail's oldest point farther than this from every area centre is not "near" any
const AHEAD_H = 72; // how far forward smoke from today's fires is followed
const AHEAD_FIRES = 150; // strongest fires of the last 24 h that are followed
const REACH_KM = 75; // smoke "reaches" Singapore when it comes this close
const NEW_KM = 50; // a fire with none this close on an earlier day starts a new fire zone (each day keeps only its strongest fires, so closer is noise)
const ZONE_KM = 30; // new fires this close together are one zone

// Rough province and state centres; a fire belongs to the nearest. Good enough to name where most fires were.
const AREAS: [string, number, number][] = [
  ["Aceh", 4.2, 96.8],
  ["North Sumatra", 2.2, 99.1],
  ["Riau", 0.3, 101.7],
  ["West Sumatra", -0.8, 100.6],
  ["Jambi", -1.6, 103.0],
  ["Bengkulu", -3.6, 102.3],
  ["South Sumatra", -3.3, 104.3],
  ["Lampung", -4.8, 105.1],
  ["Bangka-Belitung", -2.5, 106.4],
  ["West Kalimantan", 0.0, 110.5],
  ["Central Kalimantan", -1.6, 113.4],
  ["South Kalimantan", -3.0, 115.3],
  ["East Kalimantan", 0.5, 116.5],
  ["North Kalimantan", 3.0, 116.3],
  ["Sarawak", 2.5, 113.0],
  ["Sabah", 5.3, 117.0],
  ["Peninsular Malaysia", 3.8, 102.0],
];

/** Map colours for fires and for the air's path, shared by every view of the replay. */
export const FIRE_COLOR = "#c2410c";
export const TRAIL_COLOR = "#a855f7";
export const NEW_FIRE_COLOR = "#5fe3ee";

/** The key to the line that follows today's strongest fires on the wind, on the Now map and the globe. Whether that smoke reaches Singapore is said by `aheadParts` (the "Smoke on the way" heading of SmokeAhead and the globe's headline). */
export const AHEAD_LABEL = "Where today's smoke goes";

/** The browser-side API paths that pages preload (`preload(url, { as: "fetch", crossOrigin: "anonymous" })`), so that the data is on its way before the code that uses it has loaded. */
export const REPLAY_URL = "/api/replay";
export const SMOKE_URL = "/api/smoke";

const SHARED_TTL = 300_000; // the browser's cache lifetime of an answer; a longer-lived page asks again
const shared = new Map<string, { at: number; promise: Promise<unknown> }>();

/**
 * The JSON at one of the API paths above, in the browser (the CDN caches it). Every caller shares one request, in flight or done,
 * for SHARED_TTL; after a failure the next call asks again. Rejects when it is unavailable.
 */
function fetchShared<T>(url: string): Promise<T> {
  const old = shared.get(url);
  if (old && Date.now() - old.at < SHARED_TTL) return old.promise as Promise<T>;
  const mine = {
    at: Date.now(),
    promise: fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject()))
      .catch((e) => {
        if (shared.get(url) === mine) shared.delete(url);
        throw e;
      }),
  };
  shared.set(url, mine);
  return mine.promise as Promise<T>;
}

/** The replay from /api/replay, in the browser. */
export const fetchReplay = () => fetchShared<Replay>(REPLAY_URL);

/** The smoke forecast grid from /api/smoke, in the browser. */
export const fetchSmoke = () => fetchShared<SmokeGrid>(SMOKE_URL);

/** Equirectangular distance in km; fine at these scales near the equator. */
function km(a: readonly number[], lat: number, lon: number) {
  const x = (lon - a[1]) * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(lat - a[0], x) * 111.32;
}

const nearestArea = (lat: number, lon: number) => AREAS.reduce((best, a) => (km([a[1], a[2]], lat, lon) < km([best[1], best[2]], lat, lon) ? a : best));
const areaOf = (lat: number, lon: number) => nearestArea(lat, lon)[0];

/** The province or state with most of the given fires, or null for none. */
function topArea(fires: { lat: number; lon: number }[]) {
  const counts = new Map<string, number>();
  for (const f of fires) {
    const a = areaOf(f.lat, f.lon);
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Compass point the air came from, or null if it barely moved. */
export function fromDirection(trail: [number, number][]) {
  const [lat, lon] = trail.at(-1)!;
  if (km([SG.lat, SG.lon], lat, lon) < 150) return null;
  const deg = (Math.atan2(lon - SG.lon, lat - SG.lat) * 180) / Math.PI;
  return windFrom(deg);
}

/** Whether a point lies within NEAR_KM of the trail. */
export const isNearTrail = (trail: [number, number][], [lat, lon]: [number, number]) => trail.some((p) => km(p, lat, lon) < NEAR_KM);

/** Fires the trail passed within NEAR_KM while the air was on its way, and the area with most of them. */
function firesPassed(trail: [number, number][], arrival: number, fires: Fire[]) {
  const from = arrival - WINDOW_H * 3600_000;
  const box = trail.reduce((b, [la, lo]) => [Math.min(b[0], la), Math.max(b[1], la), Math.min(b[2], lo), Math.max(b[3], lo)], [90, -90, 180, -180]);
  const pad = NEAR_KM / 100;
  const passed = fires.filter((f) => {
    const t = Date.parse(f.time);
    if (t < from || t > arrival) return false;
    if (f.lat < box[0] - pad || f.lat > box[1] + pad || f.lon < box[2] - pad || f.lon > box[3] + pad) return false;
    return isNearTrail(trail, [f.lat, f.lon]);
  });
  return { near: passed.length, area: topArea(passed) };
}

/** How the air travelled: length and time of the trail, and the area near where it started. Null when the air stayed near Singapore. */
function journeyOf(trail: [number, number][], arrival: number, from: string | null): Journey | null {
  if (!from) return null;
  const hours = trail.length - 1;
  const length = trail.slice(1).reduce((sum, p, i) => sum + km(trail[i], p[0], p[1]), 0);
  const [lat, lon] = trail.at(-1)!;
  const [name, aLat, aLon] = nearestArea(lat, lon);
  return {
    hours,
    km: Math.round(length / 10) * 10,
    start: km([aLat, aLon], lat, lon) <= START_MAX_KM ? name : null,
    left: new Date(arrival - hours * 3600_000).toISOString(),
  };
}

/**
 * Smoke on the way: follows the wind forecast forward from the strongest fires of the last 24 h in Sumatra and Borneo
 * and notes when the smoke first comes within REACH_KM of Singapore. Null without fires or with too little forecast.
 * When none reach, `path` is the strongest fire's forward trail, so the map still shows where the smoke goes.
 */
function aheadOf(frames: WindFrame[], fires: (Fire & { where: string })[], now: number): Ahead | null {
  if (frames.at(-1)!.t < now + 48 * 3600_000) return null;
  const strongest = fires
    .filter((f) => f.where !== "peninsula" && Date.parse(f.time) >= now - 24 * 3600_000)
    .sort((a, b) => b.frp - a.frp)
    .slice(0, AHEAD_FIRES);
  if (!strongest.length) return null;
  const followed = strongest.map((f) => {
    const path = forwardTrail(frames, f.lat, f.lon, now, AHEAD_H);
    return { f, path, h: path.findIndex((p) => km(p, SG.lat, SG.lon) < REACH_KM) };
  });
  const reaching = followed.filter((r) => r.h >= 0).sort((a, b) => a.h - b.h);
  const base = { checked: strongest.length, fires: reaching.length };
  if (!reaching.length) return { ...base, area: null, hours: null, at: null, path: followed[0].path };
  const mid = (reaching.length - 1) / 2;
  const median = (reaching[Math.floor(mid)].h + reaching[Math.ceil(mid)].h) / 2;
  const hours = Math.max(1, Math.round(median));
  const typical = reaching.reduce((a, b) => (Math.abs(b.h - median) < Math.abs(a.h - median) ? b : a));
  return { ...base, area: topArea(reaching.map((r) => r.f)), hours, at: new Date(now + hours * 3600_000).toISOString(), path: typical.path.slice(0, typical.h + 1) };
}

/** New fire zones: the newest day's fires with no fire within NEW_KM on any earlier day, one per ZONE_KM. Empty without earlier fires to compare with. */
export function newFires(days: { fires: readonly (readonly number[])[] }[]): [number, number][] {
  const before = days.slice(0, -1).flatMap((d) => d.fires);
  if (!before.length) return [];
  const zones: [number, number][] = [];
  for (const [lat, lon] of days.at(-1)?.fires ?? [])
    if (!before.some((p) => km(p, lat, lon) < NEW_KM) && !zones.some((z) => km(z, lat, lon) < ZONE_KM)) zones.push([lat, lon]);
  return zones;
}

/** Wind (m/s) at Singapore on the replay's grid as the compass point it blows from and its speed in km/h; null outside the grid. */
export function windAtSg({ lats, lons }: Pick<Replay, "lats" | "lons">, { u, v }: ReplayDay["wind"]) {
  const x = sample({ lats, lons, data: u }, SG.lat, SG.lon);
  const y = sample({ lats, lons, data: v }, SG.lat, SG.lon);
  if (x == null || y == null) return null;
  return { from: windFrom((Math.atan2(-x, -y) * 180) / Math.PI), kmh: Math.round(Math.hypot(x, y) * 3.6) };
}

/** One line on where the day's air came from; `future` for a forecast day, which has no fires to name. */
export function trailCaption(d: Pick<ReplayDay, "from" | "area" | "near">, future = false) {
  const verb = future ? ["should stay", "should come"] : ["stayed", "came"];
  if (!d.from) return `Light winds: the air ${verb[0]} around Singapore.`;
  const via = !future && d.area && d.near > 0 ? ` via ${d.area}, past ${d.near.toLocaleString("en-SG")} fires` : "";
  return `Air ${verb[1]} from the ${d.from}${via}.`;
}

/** The "Smoke on the way" sentence in parts, or null when no smoke from today's fires reaches Singapore. */
export function aheadParts({ fires, checked, area, hours, at }: Ahead) {
  if (!(fires > 0 && hours != null && at != null)) return null;
  return {
    reach: `Smoke from ${fires} of today's ${checked} ${checked < AHEAD_FIRES ? "" : "strongest "}fires should reach Singapore in about ${hoursText(hours)}.`,
    source: area ? `Most of it comes from ${area}.` : null,
    expected: `Expected around ${fmtDayHour(at)}.`,
  };
}

/** "3 new fire zones". */
export const newZonesText = (n: number) => `${n.toLocaleString("en-SG")} new fire ${n === 1 ? "zone" : "zones"}`;

/** Wind at Singapore as a phrase: "Wind from the southwest, 12 km/h". */
export const windText = ({ from, kmh }: NonNullable<ReturnType<typeof windAtSg>>) => `Wind from the ${from}, ${kmh} km/h`;

/** "1 hour" or "38 hours". */
const hoursText = (h: number) => `${h} ${h === 1 ? "hour" : "hours"}`;

/** The journey in short phrases, shared by the page and the picture. Null when the air stayed near Singapore. */
export function journeyText(d: ReplayDay) {
  const j = d.journey;
  if (!j) return null;
  return {
    left: j.start ? `Left near ${j.start}` : `Left far to the ${d.from}`,
    leftAt: fmtDayHour(j.left),
    reached: "Reached Singapore",
    reachedAt: fmtDayHour(d.arrival),
    trip: `${j.km.toLocaleString("en-SG")} km in ${hoursText(j.hours)}`,
    fires: d.near > 0 ? `Passed ${d.near.toLocaleString("en-SG")} ${d.near === 1 ? "fire" : "fires"}` : "Passed no fires",
  };
}

/** The frame nearest `t`; throws without frames. */
export function nearestFrame(frames: WindFrame[], t: number) {
  if (!frames.length) throw new Error("no wind frame");
  return frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
}

/** Wind of the frame nearest `t`, rounded for the page. */
export function windNear(frames: WindFrame[], t: number) {
  const f = nearestFrame(frames, t);
  const r = (xs: number[]) => xs.map((x) => Math.round(x * 10) / 10);
  return { u: r(f.u.data), v: r(f.v.data) };
}

/** The moment (ms) the air of SGT `date` is traced from: ARRIVAL_SGT o'clock SGT. */
export const arrivalAt = (date: string) => sgtTime(date, ARRIVAL_SGT);

/** The air that reached Singapore at ARRIVAL_SGT on SGT `date` (not after `latest`, ms): when, and its WINDOW_H-hour back-trail. */
export function dayTrail(frames: WindFrame[], date: string, latest = Infinity) {
  const arrival = Math.min(arrivalAt(date), latest);
  return { arrival, trail: backTrail(frames, SG.lat, SG.lon, arrival, WINDOW_H) };
}

/** The past few days: each day's fires and where the air reaching Singapore came from. */
export function buildReplay(frames: WindFrame[], fires: (Fire & { where: string })[], now = Date.now()): Replay {
  const latest = frames.filter((f) => f.t <= now).at(-1)?.t ?? now;
  const days: ReplayDay[] = [];
  for (let k = DAYS - 1; k >= 0; k--) {
    const date = sgDate(-k, new Date(now));
    const { arrival, trail } = dayTrail(frames, date, latest);
    const from = fromDirection(trail);
    const today = fires.filter((f) => sgDate(0, new Date(f.time)) === date);
    days.push({
      date,
      arrival: new Date(arrival).toISOString(),
      trail,
      from,
      ...firesPassed(trail, arrival, fires),
      journey: journeyOf(trail, arrival, from),
      ahead: k === 0 ? aheadOf(frames, fires, now) : null,
      fires: today
        .sort((a, b) => b.frp - a.frp)
        .slice(0, MAP_FIRES)
        .map((f) => [Math.round(f.lat * 100) / 100, Math.round(f.lon * 100) / 100]),
      total: today.filter((f) => f.where !== "peninsula").length,
      wind: windNear(frames, arrival),
    });
  }
  const { lats, lons } = frames[0].u;
  return { lats, lons, days };
}
