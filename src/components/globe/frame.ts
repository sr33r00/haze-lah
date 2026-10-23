import { latestFireDay, type HistoryDay } from "@/lib/historyTypes";
import type { PollutantId } from "@/lib/pollutants";
import { MAP_FIRES, arrivalAt, dayTrail, newFires } from "@/lib/replay";
import type { Bar } from "@/lib/timeline";
import type { Replay, SmokeGrid } from "@/lib/types";
import { sgDate } from "@/lib/util";
import { windOf, type Wind } from "@/lib/windParticles";
import type { WindFrame } from "@/lib/wind";

/** What the colour layer shows: a CAMS pollutant, the satellite's smoke picture, or nothing. */
export type LayerChoice = PollutantId | "smoke" | "off";

type Pt = [lat: number, lon: number];

/** One 3-hour step of the globe: everything it draws. Lists are empty, and `field` and `wind` null, where the day has none. */
export type GlobeDay = {
  date: string;
  kind: Bar["kind"];
  /** The day's fires: lat, lon, FRP in MW (0 where the source has no FRP, as the live replay). */
  fires: [number, number, number][];
  /** The date of the day the fires are from: `date`, except on today before the afternoon pass, which shows the newest day with enough fires; null for a forecast day, which shows none of its own. */
  fireDate: string | null;
  /** The fires of the days before, drawn dim. */
  older: Pt[];
  /** New fire zones: fires with none within 50 km on the days before, one per 30 km (`newFires`). */
  fresh: Pt[];
  /** Where the air reaching Singapore at 2 pm came from, newest first. */
  trail: Pt[];
  /** Where smoke from today's fires goes next (today only). */
  ahead: Pt[];
  /** The grid `field` and `wind` are on. */
  grid: { lats: number[]; lons: number[] };
  wind: { u: number[]; v: number[] } | null;
  /** The layer's CAMS values on `grid`, row-major by latitude; null for "off" and "smoke" and where the day has no grid. */
  field: number[] | null;
};

export type GlobeSource = {
  history?: HistoryDay;
  replay?: Replay;
  smoke?: SmokeGrid;
  /** The history days before `history`, oldest first, for the dim fires and the new zones. Only the last `DIM_DAYS` are used. */
  before?: { fires: readonly (readonly number[])[] }[];
};

/** How many days before the shown one are dimmed in. */
export const DIM_DAYS = 4;
const HOUR = 3600_000;

const pairs = (fires: readonly (readonly number[])[]): Pt[] => fires.map((f) => [f[0], f[1]]);
const withFrp = (fires: readonly (readonly number[])[]): GlobeDay["fires"] => fires.map((f) => [f[0], f[1], f[2] ?? 0]);

/** The forecast's 72-hour back-trail of the air reaching Singapore at 2 pm SGT on `date`: only the hours the forecast wind covers; [] without wind or when the arrival is after the last forecast hour. */
function forecastTrail(smoke: SmokeGrid, date: string): Pt[] {
  const { wind, times, lats, lons } = smoke;
  if (!wind || !times.length) return [];
  const frames: WindFrame[] = times.map((t, i) => ({ t: Date.parse(t), u: { lats, lons, data: wind.u[i] }, v: { lats, lons, data: wind.v[i] } }));
  const last = frames[frames.length - 1].t;
  if (arrivalAt(date) > last) return []; // past the last frame: the trail would be that of an earlier hour
  const { arrival, trail } = dayTrail(frames, date, last);
  const covered = Math.floor((arrival - frames[0].t) / HOUR);
  return covered < 1 ? [] : trail.slice(0, covered + 1);
}

/** The values of `layer` in a source's per-pollutant grids (frame lists), or undefined for "off" and "smoke". */
const gridsOf = (layer: LayerChoice, pick: (id: PollutantId) => number[][] | undefined) => (layer === "off" || layer === "smoke" ? undefined : pick(layer));

/**
 * The globe for one step of one day. `step` indexes the day's steps as `stepsOf` lists them: a history day its 8 frames, today
 * and forecast days the smoke steps inside that SGT date, a live past day its single step (which has no grid). `today` is the SGT
 * date the timeline calls today. Never throws: what a day lacks is empty.
 */
export function globeDay(source: GlobeSource, date: string, step: number, layer: LayerChoice, today = sgDate()): GlobeDay {
  const { history, replay, smoke, before = [] } = source;
  const kind: GlobeDay["kind"] = date > today ? "forecast" : date === today ? "today" : "past";
  const days = replay?.days ?? [];
  const own = kind === "past" && history?.date === date ? history : undefined;
  const at = days.findIndex((d) => d.date === date);
  const liveAt = kind === "today" && at < 0 ? days.length - 1 : at; // the newest replay day stands in for today
  const live = kind === "forecast" ? undefined : days[liveAt];
  const out: GlobeDay = { date, kind, fires: [], fireDate: null, older: [], fresh: [], trail: [], ahead: [], grid: { lats: [], lons: [] }, wind: null, field: null };

  // Fires. A day that has only just begun has few: today shows the newest day with enough, its path and wind stay today's.
  if (own) {
    const prior = before.slice(-DIM_DAYS);
    Object.assign(out, { fires: withFrp(own.fires), fireDate: date, older: prior.flatMap((d) => pairs(d.fires)), fresh: newFires([...prior, own].map((d) => ({ fires: d.fires.slice(0, MAP_FIRES) }))) }); // the strongest MAP_FIRES of each day, as the live replay keeps, so that a date has the same zones here as on Now
  } else if (live) {
    const upTo = days.slice(0, liveAt + 1);
    const shown = kind === "today" ? (latestFireDay(upTo) ?? live) : live;
    const k = upTo.indexOf(shown);
    Object.assign(out, { fires: withFrp(shown.fires), fireDate: shown.date, older: upTo.slice(Math.max(0, k - DIM_DAYS), k).flatMap((d) => pairs(d.fires)), fresh: newFires(upTo.slice(0, k + 1)) });
  } else if (kind === "forecast") {
    const fireDay = latestFireDay(days) ?? days[days.length - 1];
    out.older = pairs(fireDay?.fires ?? []);
  }

  // The air's path.
  out.trail = own ? own.trail : kind === "forecast" ? (smoke ? forecastTrail(smoke, date) : []) : (live?.trail ?? []);
  if (kind === "today") out.ahead = live?.ahead?.path ?? [];

  // The grid, the wind and the field of the step.
  if (own) {
    const i = Math.min(Math.max(0, step), own.times.length - 1);
    out.grid = { lats: own.lats, lons: own.lons };
    out.wind = own.wind.u[i] && own.wind.v[i] ? { u: own.wind.u[i], v: own.wind.v[i] } : null;
    out.field = gridsOf(layer, (id) => own.gases[id])?.[i] ?? null;
  } else if (smoke && kind !== "past") {
    out.grid = { lats: smoke.lats, lons: smoke.lons };
    const first = smoke.times.findIndex((t) => sgDate(0, new Date(t)) === date);
    const count = smoke.times.filter((t) => sgDate(0, new Date(t)) === date).length;
    if (first >= 0) {
      const i = first + Math.min(Math.max(0, step), count - 1);
      out.wind = smoke.wind ? { u: smoke.wind.u[i], v: smoke.wind.v[i] } : null;
      out.field = gridsOf(layer, (id) => (id === "pm25" ? smoke.values : smoke.gases?.[id]))?.[i] ?? null;
    }
  } else if (live && replay) {
    out.grid = { lats: replay.lats, lons: replay.lons };
    out.wind = live.wind;
  }
  return out;
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const point = ([lat, lon]: readonly number[], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [lon, lat] } });
const line = (path: Pt[]): GeoJSON.FeatureCollection =>
  fc(path.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path.map(([lat, lon]) => [lon, lat]) } }] : []);

/** Hours back along the trail that carry a dot and a label. */
const TRAIL_MARKS = [24, 48, 72];

/** The day as GeoJSON (lon, lat), one collection per source of the map. */
export function frameGeo(day: GlobeDay) {
  return {
    fires: fc(day.fires.map((f) => point(f))),
    older: fc(day.older.map((f) => point(f))),
    fresh: fc(day.fresh.map((f) => point(f))),
    trail: line(day.trail),
    hours: fc(TRAIL_MARKS.filter((h) => h < day.trail.length).map((h) => point(day.trail[h], { label: `${h} h` }))),
    ahead: line(day.ahead),
  };
}

const PAD = 7; // cells of calmer wind added round the grid, so that the wind animation's own edge falls outside the picture

/** The wind grid with `PAD` cells added on every side: the edge values carried outwards, easing to the grid's mean and weakening with distance. */
function padded({ lats, lons }: GlobeDay["grid"], u: number[], v: number[]): Wind {
  const ext = (a: number[]) => [...Array.from({ length: PAD }, (_, k) => a[0] - (PAD - k) * (a[1] - a[0])), ...a, ...Array.from({ length: PAD }, (_, k) => a[a.length - 1] + (k + 1) * (a[1] - a[0]))];
  const nLat = lats.length;
  const nLon = lons.length;
  const grow = (f: number[]) => {
    const mean = f.reduce((a, b) => a + b, 0) / f.length;
    const out: number[] = [];
    for (let r = -PAD; r < nLat + PAD; r++)
      for (let c = -PAD; c < nLon + PAD; c++) {
        const rr = Math.min(nLat - 1, Math.max(0, r));
        const cc = Math.min(nLon - 1, Math.max(0, c));
        const d = Math.max(Math.abs(r - rr), Math.abs(c - cc));
        out.push((f[rr * nLon + cc] + (mean - f[rr * nLon + cc]) * Math.min(1, d / 4)) * (1 - 0.06 * d)); // towards the grid's mean, so that columns do not stripe
      }
    return out;
  };
  return windOf(ext(lats), ext(lons), grow(u), grow(v));
}

/** The day's wind for the particle animation, padded so that its edge is off the picture; undefined without wind. */
export const flowOf = (grid: GlobeDay["grid"], wind: GlobeDay["wind"]): Wind | undefined =>
  wind && grid.lats.length > 1 && grid.lons.length > 1 ? padded(grid, wind.u, wind.v) : undefined;
