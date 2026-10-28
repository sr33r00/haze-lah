import type { HourPoint, SmokeGrid, Station, WeatherHour } from "../types";
import { SG, getJson, haversineKm, sgtTime } from "../util";
import type { WindFrame } from "../wind";
import { POLLUTANTS, type PollutantId } from "../pollutants";
import { GRID } from "../modelGrid";

// Open-Meteo: ECMWF weather and Copernicus CAMS air-quality forecasts (CC BY 4.0).

type AQ = { hourly: { time: string[]; pm2_5: (number | null)[] } };
/** One grid point of a multi-variable CAMS answer: `time` plus one array per requested variable (absent when the model lacks it). */
export type AQPoint = { hourly: { time: string[] } & { [camsVar: string]: (number | null)[] | string[] | undefined } };
type GridWind = { hourly: { time: string[]; wind_speed_850hPa: (number | null)[]; wind_direction_850hPa: (number | null)[] } };
type WX = {
  hourly: {
    time: string[];
    wind_direction_850hPa: (number | null)[];
    wind_speed_850hPa: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    wind_gusts_10m: (number | null)[];
    uv_index: (number | null)[];
    apparent_temperature: (number | null)[];
  };
};

// Open-Meteo returns local times without offset when timezone is set; we ask for GMT and add Z.
const z = (t: string) => (t.endsWith("Z") ? t : `${t}Z`);

export async function fetchCamsSingapore(): Promise<HourPoint[]> {
  const j = await getJson<AQ>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SG.lat}&longitude=${SG.lon}&hourly=pm2_5&domains=cams_global&timezone=GMT&past_days=2&forecast_days=5`,
    { revalidate: 1800 },
  );
  return j.hourly.time
    .map((t, i) => ({ time: new Date(z(t)).toISOString(), value: j.hourly.pm2_5[i] }))
    .filter((p): p is HourPoint => p.value != null);
}

export async function fetchWeather(): Promise<WeatherHour[]> {
  const j = await getJson<WX>(
    `https://api.open-meteo.com/v1/forecast?latitude=${SG.lat}&longitude=${SG.lon}&hourly=wind_direction_850hPa,wind_speed_850hPa,precipitation_probability,precipitation,wind_gusts_10m,uv_index,apparent_temperature&timezone=GMT&past_days=1&forecast_days=5`,
    { revalidate: 1800 },
  );
  const h = j.hourly;
  return h.time.map((t, i) => ({
    time: new Date(z(t)).toISOString(),
    windDir: h.wind_direction_850hPa[i] ?? NaN,
    windSpeed: h.wind_speed_850hPa[i] ?? NaN,
    rainProb: h.precipitation_probability[i],
    rain: h.precipitation[i],
    gust: h.wind_gusts_10m[i] ?? null,
    uv: h.uv_index?.[i] ?? null,
    feelsLike: h.apparent_temperature?.[i] ?? null,
  }));
}

// Upwind Indonesian cities near the main peatland fire areas. No open real-time
// station feed is available for these, so we show the CAMS model estimate.
const UPWIND = [
  { id: "pekanbaru", name: "Pekanbaru", state: "Riau", lat: 0.5071, lon: 101.4478 },
  { id: "jambi", name: "Jambi", state: "Jambi", lat: -1.61, lon: 103.61 },
  { id: "palembang", name: "Palembang", state: "South Sumatra", lat: -2.9761, lon: 104.7754 },
  { id: "pontianak", name: "Pontianak", state: "West Kalimantan", lat: -0.0263, lon: 109.3425 },
  { id: "palangkaraya", name: "Palangka Raya", state: "Central Kalimantan", lat: -2.2161, lon: 113.914 },
];

export async function fetchUpwindModel(): Promise<Station[]> {
  const lats = UPWIND.map((c) => c.lat).join(",");
  const lons = UPWIND.map((c) => c.lon).join(",");
  const j = await getJson<AQ[] | AQ>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm2_5&domains=cams_global&timezone=GMT&past_days=0&forecast_days=1`,
    { revalidate: 1800 },
  );
  const arr = Array.isArray(j) ? j : [j];
  const nowIdx = (times: string[]) => {
    const now = Date.now();
    let best = 0;
    times.forEach((t, i) => {
      if (Date.parse(z(t)) <= now) best = i;
    });
    return best;
  };
  return UPWIND.map((c, k) => {
    const h = arr[k]?.hourly;
    const i = h ? nowIdx(h.time) : 0;
    const v = h?.pm2_5[i];
    return {
      ...c,
      country: "ID" as const,
      api: null,
      pm25: v != null ? Math.round(v) : null,
      time: h ? new Date(z(h.time[i])).toISOString() : null,
      distanceKm: Math.round(haversineKm(SG.lat, SG.lon, c.lat, c.lon)),
    };
  });
}

/** Runs `go`; after each failure waits the next of `waits` (ms) and tries again, so it is tried `waits.length + 1` times in all. */
async function withRetry<T>(go: () => Promise<T>, waits: number[]): Promise<T> {
  for (const wait of waits) {
    try {
      return await go();
    } catch {
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return go();
}

/** The CAMS variables of every pollutant, as an `hourly=` list. */
const CAMS_VARS = POLLUTANTS.map((p) => p.camsVar).join(",");

/** The 1° regional grid, and its points as an Open-Meteo multi-location query. */
export function gridQuery() {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let la = GRID.lat[0]; la <= GRID.lat[1]; la += GRID.step) lats.push(la);
  for (let lo = GRID.lon[0]; lo <= GRID.lon[1]; lo += GRID.step) lons.push(lo);
  const pts = lats.flatMap((la) => lons.map((lo) => [la, lo]));
  return { lats, lons, where: `latitude=${pts.map((p) => p[0]).join(",")}&longitude=${pts.map((p) => p[1]).join(",")}` };
}

/** u (towards the east) and v (towards the north) in m/s from speed and the direction the wind comes from. */
const toUV = (s: number, d: number) => [-s * Math.sin((d * Math.PI) / 180), -s * Math.cos((d * Math.PI) / 180)];

/** Wind frames from a multi-point answer (one entry per grid point, in the order of gridQuery); a missing hour is calm. */
function windFramesOf(w: GridWind[], lats: number[], lons: number[]): WindFrame[] {
  return w[0].hourly.time.map((t, i) => {
    const uv = w.map(({ hourly: h }) => toUV(h.wind_speed_850hPa[i] ?? 0, h.wind_direction_850hPa[i] ?? 0));
    return { t: Date.parse(z(t)), u: { lats, lons, data: uv.map((x) => x[0]) }, v: { lats, lons, data: uv.map((x) => x[1]) } };
  });
}

/** 850 hPa wind over the grid for the past week and the next 3 days, every 3 hours (ECMWF analysis and forecast). One request of 364 locations: the hourly job fetches it every 3 hours and stores it (`windData.ts`). */
export async function fetchWindFrames(): Promise<WindFrame[]> {
  const { lats, lons, where } = gridQuery();
  const url = `https://api.open-meteo.com/v1/forecast?${where}&hourly=wind_speed_850hPa,wind_direction_850hPa&wind_speed_unit=ms&timezone=GMT&past_days=7&forecast_days=4&temporal_resolution=hourly_3`;
  // Open-Meteo sometimes answers a large request with 503 "overloaded", so it is tried twice.
  const w = await withRetry(() => getJson<GridWind[]>(url, { revalidate: 10800 }), [3000]);
  return windFramesOf(w, lats, lons);
}

// History: Open-Meteo's archives, for the day files (src/lib/jobs/history.ts). Large answers, so a longer timeout; and a rate-limited or
// overloaded answer (429, 503) is tried again after 10 s, then 65 s (the limit is per minute).
const HISTORY_RETRY = [10_000, 65_000];
const HISTORY_TIMEOUT = 90_000;

/** Hourly 850 hPa wind over the grid for the UTC dates `start` to `end` (YYYY-MM-DD, inclusive), from the historical forecast archive. */
export async function fetchHistoryWind(start: string, end: string): Promise<WindFrame[]> {
  const { lats, lons, where } = gridQuery();
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?${where}&hourly=wind_speed_850hPa,wind_direction_850hPa&wind_speed_unit=ms&timezone=GMT&start_date=${start}&end_date=${end}`;
  return windFramesOf(await withRetry(() => getJson<GridWind[]>(url, { timeout: HISTORY_TIMEOUT }), HISTORY_RETRY), lats, lons);
}

/** Hourly CAMS air quality over the grid for the UTC dates `start` to `end` (YYYY-MM-DD, inclusive), one entry per grid point. */
export function fetchHistoryAQ(start: string, end: string): Promise<AQPoint[]> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${gridQuery().where}&hourly=${CAMS_VARS}&domains=cams_global&timezone=GMT&start_date=${start}&end_date=${end}`;
  return withRetry(() => getJson<AQPoint[]>(url, { timeout: HISTORY_TIMEOUT }), HISTORY_RETRY);
}

/**
 * One variable on the grid at the hourly indexes `idx`: [frame][lat*lons+lon], rounded to integers. A missing cell is 0, the same
 * as in the PM2.5 `values`, so the grid never holds null or NaN. Null when the variable is null (or absent) everywhere.
 */
export function gridFrames(aq: AQPoint[], idx: number[], v: string): number[][] | null {
  const col = aq.map((loc) => loc.hourly[v] as (number | null)[] | undefined);
  if (!idx.some((i) => col.some((c) => c?.[i] != null))) return null;
  return idx.map((i) => col.map((c) => Math.round(c?.[i] ?? 0)));
}

/** Every CAMS gas (not PM2.5) that has data, keyed by pollutant id. */
export function gasFrames(aq: AQPoint[], idx: number[]): SmokeGrid["gases"] {
  const gases: SmokeGrid["gases"] = {};
  for (const p of POLLUTANTS) {
    if (p.id === "pm25") continue;
    const f = gridFrames(aq, idx, p.camsVar);
    if (f) gases[p.id] = f;
  }
  return gases;
}

/**
 * The air quality of one SGT day (00:00 to 24:00 SGT) from hourly answers that cover it: 8 frames, 3 hours apart, for every
 * pollutant that has data (PM2.5 too), in the shape of a history day. Throws when the answer lacks any of the 8 hours.
 */
export function dayAQ(aq: AQPoint[], lats: number[], lons: number[], date: string) {
  const start = sgtTime(date);
  const hours = aq[0].hourly.time.map((t) => Date.parse(z(t)));
  const idx = Array.from({ length: 8 }, (_, k) => hours.indexOf(start + k * 3 * 3600_000));
  if (idx.includes(-1)) throw new Error(`Open-Meteo air quality does not cover ${date} (SGT)`);
  const values: Partial<Record<PollutantId, number[][]>> = {};
  for (const p of POLLUTANTS) {
    const f = gridFrames(aq, idx, p.camsVar);
    if (f) values[p.id] = f;
  }
  return { times: idx.map((i) => new Date(hours[i]).toISOString()), lats, lons, values };
}

/**
 * The wind of the smoke grid's steps from the stored wind frames (same grid, 3-hourly on the same UTC hours): u and v in m/s to 0.1 for each time in `times`
 * (ms). A step the frames end before holds the last frame rather than show calm air. Null when there are no frames, so missing wind never looks like calm air.
 */
function smokeWind(frames: WindFrame[] | null, times: number[]): SmokeGrid["wind"] {
  if (!frames?.length) return null;
  const byTime = new Map(frames.map((f) => [f.t, f]));
  const steps = times.map((t) => byTime.get(t) ?? frames[frames.length - 1]);
  const round = (data: number[]) => data.map((x) => Math.round(x * 10) / 10);
  return { u: steps.map((f) => round(f.u.data)), v: steps.map((f) => round(f.v.data)) };
}

/** Regional CAMS forecast (PM2.5 and the gases) on a 1° grid, sampled every 3 h for the next 72 h, with the 850 hPa wind from `wind` (see `fetchWindFrames`; null for none). */
export async function fetchSmokeGrid(wind: WindFrame[] | null): Promise<SmokeGrid> {
  const { lats, lons, where } = gridQuery();
  // The air-quality API has no wind; the caller gives the weather API's wind (fetched once for all, same level as the wind dial).
  const j = await getJson<AQPoint[]>(`https://air-quality-api.open-meteo.com/v1/air-quality?${where}&hourly=${CAMS_VARS}&domains=cams_global&timezone=GMT&forecast_days=4`, {
    revalidate: 10800,
  });
  const now = Date.now() - 3600_000;
  const idx = j[0].hourly.time
    .map((t, i) => ({ t: Date.parse(z(t)), i }))
    .filter(({ t }) => t >= now && new Date(t).getUTCHours() % 3 === 0)
    .slice(0, 25);
  return {
    lats,
    lons,
    times: idx.map(({ t }) => new Date(t).toISOString()),
    values: gridFrames(j, idx.map(({ i }) => i), "pm2_5") ?? [], // no PM2.5 at all is no model, never a grid of zeros that reads as clean air
    gases: gasFrames(j, idx.map(({ i }) => i)),
    wind: smokeWind(wind, idx.map(({ t }) => t)),
  };
}
