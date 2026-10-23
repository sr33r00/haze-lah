import type { HistoryDay, HistoryIndex } from "./historyTypes";
import type { PollutantId } from "./pollutants";
import { dayTrail, nearestFrame, windNear } from "./replay";
import { classify } from "./sources/firmsCsv";
import type { Fire } from "./types";
import { sgtTime } from "./util";
import type { WindFrame } from "./wind";

// Day files of the air globe's timeline: data/history/<date>.json, one per Singapore day, written by scripts/history.ts.

/** Most fires a day file keeps (the strongest); the totals still count all. */
const DAY_FIRES = 1500;
/** Size a day file is kept under (bytes of JSON): the grids take about 80 KB, so on a day with very many fires the weakest are left out. */
const DAY_BYTES = 100_000;

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
  const start = sgtTime(date);
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

/**
 * Throws when a day has no fires at all in Sumatra, Borneo and the peninsula. The region always has some, so a total of 0 is a
 * FIRMS gap, not a clean day, and a day file is never rewritten by the daily job. Returns `day`.
 */
export function assertFires(day: HistoryDay): HistoryDay {
  const { sumatra, borneo, peninsula } = day.totals;
  if (sumatra + borneo + peninsula === 0) throw new Error(`History ${day.date}: no fires in the three areas, which means FIRMS has no data for the day yet. Not saved.`);
  return day;
}

/** The index with `day` added, replacing the entry of the same date; dates stay sorted. `updated` is `now`. */
export function addToIndex(index: HistoryIndex, day: HistoryDay, now = new Date()): HistoryIndex {
  const entry = { date: day.date, fires: day.totals.sumatra + day.totals.borneo, psiMax: day.nea.psiMax };
  const days = [...index.days.filter((d) => d.date !== day.date), entry].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { updated: now.toISOString(), days };
}
