import type { PollutantId } from "./pollutants";
import { dayTrail, nearestFrame, windNear } from "./replay";
import { classify } from "./sources/firmsCsv";
import type { Fire } from "./types";
import type { WindFrame } from "./wind";

/**
 * Yearly peak 24-hr PSI (highest region) from NEA's historical 24-hr PSI, hourly from April 2014:
 * data.gov.sg dataset d_b4cf557f8750260d229c49fd768e11ed. Computed from the dataset; 2026 is excluded
 * because the current episode is in it.
 */
const PSI_YEAR_PEAKS: Record<number, number> = {
  2014: 125,
  2015: 322,
  2016: 143,
  2017: 143,
  2018: 91,
  2019: 154,
  2020: 84,
  2021: 124,
  2022: 75,
  2023: 123,
  2024: 77,
  2025: 114,
};

export const HISTORY_URL = "https://data.gov.sg/datasets/d_b4cf557f8750260d229c49fd768e11ed/view";

/** How rare a peak 24-hr PSI is against NEA's yearly peaks; null when it is not above Moderate. */
export function sinceWhen(peak: number): string | null {
  if (peak <= 100) return null;
  const year = Object.keys(PSI_YEAR_PEAKS)
    .map(Number)
    .sort((a, b) => b - a)
    .find((y) => PSI_YEAR_PEAKS[y] >= peak);
  return year ? `Highest since ${year} (peak ${PSI_YEAR_PEAKS[year]})` : "Highest since NEA's open records began in 2014";
}

// Day files of the air globe's timeline: data/history/<date>.json, one per Singapore day, written by scripts/history.ts.

/** Most fires a day file keeps (the strongest); the totals still count all. */
const DAY_FIRES = 1500;
/** Size a day file is kept under (bytes of JSON): the grids take about 80 KB, so on a day with very many fires the weakest are left out. */
const DAY_BYTES = 100_000;

/**
 * One SGT day (00:00 to 24:00 SGT, which is 16:00 UTC the day before to 16:00 UTC), as frames 3 hours apart at 00, 03, ... 21 SGT.
 * Grids are row-major by latitude, [frame][lat * lons.length + lon], on the 1° regional grid (`lats`, `lons`).
 */
export type HistoryDay = {
  date: string;
  /** The strongest fires acquired in the day (up to 1500, fewer if the file would pass 100 KB), strongest first: lat, lon (2 decimals), FRP in MW (integer). */
  fires: [lat: number, lon: number, frp: number][];
  /** All fires of the day by area, not just those listed. */
  totals: Record<"sumatra" | "borneo" | "peninsula", number>;
  /** ISO times (UTC) of the frames. */
  times: string[];
  lats: number[];
  lons: number[];
  /** 850 hPa wind in m/s to 1 decimal: u towards the east, v towards the north. */
  wind: { u: number[][]; v: number[][] };
  /** CAMS surface concentrations in µg/m³ (integers) for each pollutant that has data. */
  gases: Partial<Record<PollutantId, number[][]>>;
  /** The air that reached Singapore at 2 pm SGT, 72 hours of back-trail, one point an hour, newest first. */
  trail: [number, number][];
  /** NEA's highest 24-hr PSI and highest 1-hour PM2.5 of the day; null when NEA has none. */
  nea: { psiMax: number | null; pm25Max: number | null };
};

/** What the timeline bars need: per day the fires (Sumatra and Borneo, as the live replay counts) and Singapore's highest PSI. */
export type HistoryIndex = { updated: string; days: { date: string; fires: number; psiMax: number | null }[] };

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * A day file from the day's raw data. `fires` may hold other days (only those acquired inside the SGT day are used), `frames`
 * are hourly wind frames from three days before the day to its end (the trail needs them), `aq` is the day's 8 frames
 * (see dayAQ). Pure. Throws when the wind frames do not reach one of the 8 times.
 */
export function buildDay(input: {
  date: string;
  fires: Fire[];
  frames: WindFrame[];
  aq: { times: string[]; lats: number[]; lons: number[]; values: Partial<Record<PollutantId, number[][]>> };
  nea: HistoryDay["nea"];
}): HistoryDay {
  const { date, frames, aq, nea } = input;
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const totals = { sumatra: 0, borneo: 0, peninsula: 0 };
  const inDay: Fire[] = [];
  for (const f of input.fires) {
    const t = Date.parse(f.time);
    const where = classify(f.lat, f.lon);
    if (t < start || t >= start + 86400_000 || !where) continue;
    totals[where]++;
    inDay.push(f);
  }
  const wind = aq.times.map((time) => {
    const t = Date.parse(time);
    if (!frames.length || Math.abs(nearestFrame(frames, t).t - t) > 1.5 * 3600_000) throw new Error(`History ${date}: no wind frame near ${time}`);
    return windNear(frames, t);
  });
  const day: HistoryDay = {
    date,
    fires: [],
    totals,
    times: aq.times,
    lats: aq.lats.map(r2),
    lons: aq.lons.map(r2),
    wind: { u: wind.map((w) => w.u), v: wind.map((w) => w.v) },
    gases: Object.fromEntries(Object.entries(aq.values).map(([id, grid]) => [id, grid.map((f) => f.map(Math.round))])),
    trail: dayTrail(frames, date).trail,
    nea,
  };
  // The strongest fires first, as many as fit: DAY_FIRES, and DAY_BYTES for the whole file.
  let room = DAY_BYTES - JSON.stringify(day).length;
  for (const f of inDay.sort((a, b) => b.frp - a.frp).slice(0, DAY_FIRES)) {
    const row: HistoryDay["fires"][number] = [r2(f.lat), r2(f.lon), Math.round(f.frp)];
    room -= JSON.stringify(row).length + 1;
    if (room < 0) break;
    day.fires.push(row);
  }
  return day;
}

/** The index with `day` added, replacing the entry of the same date; dates stay sorted. `updated` is `now`. */
export function addToIndex(index: HistoryIndex, day: HistoryDay, now = new Date()): HistoryIndex {
  const entry = { date: day.date, fires: day.totals.sumatra + day.totals.borneo, psiMax: day.nea.psiMax };
  const days = [...index.days.filter((d) => d.date !== day.date), entry].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { updated: now.toISOString(), days };
}

/** The newest day (the list is oldest first) with at least `min` fires: a day with only a few is a partial or a failed pass, not a picture of the fires. */
export function latestFireDay<T extends { fires: unknown[] }>(days: T[], min = 20): T | undefined {
  return days.findLast((d) => d.fires.length >= min);
}
