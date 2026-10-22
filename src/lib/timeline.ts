import type { HistoryIndex } from "./history";
import { ARRIVAL_SGT } from "./replay";
import type { DayPsi, Replay, SmokeGrid } from "./types";
import { sgDate } from "./util";

/** One day of the globe's timeline. `source` says where its fires came from: the live replay, the history index, or neither (a gap). */
export type Bar = { date: string; kind: "past" | "today" | "forecast"; fires: number | null; source: "history" | "live" | "none" };

/** A timeline event: the first day PSI passes a threshold. */
export type Mark = { date: string; label: string };

/** NEA 24-hr PSI bands: above 100 is Unhealthy, above 200 Very unhealthy (NEA, https://www.haze.gov.sg/the-haze-situation/psi-readings-and-air-quality). */
const MARKS = [
  { above: 100, label: "PSI above 100" },
  { above: 200, label: "PSI above 200" },
];

const SGT_STEPS = [0, 3, 6, 9, 12, 15, 18, 21];

/** The SGT date `n` days after `date`. */
const addDays = (date: string, n: number) => sgDate(n, new Date(`${date}T12:00:00+08:00`));
/** The ISO UTC time of `hour` o'clock SGT on SGT `date`. */
const sgtIso = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+08:00`).toISOString();

/**
 * The timeline's days, oldest first: from the first date known (history or replay) to today, then the forecast dates in `smoke.times`.
 * A live replay day overrides the index for its date; a date between the first known one and today with neither is a gap
 * (`source: "none"`). Nothing is filled before the first known date. Pure.
 */
export function buildBars(index: HistoryIndex | null, replay: Replay, smoke: SmokeGrid, today: string): Bar[] {
  const hist = new Map((index?.days ?? []).map((d) => [d.date, d.fires]));
  const live = new Map(replay.days.map((d) => [d.date, d.total]));
  const known = [...hist.keys(), ...live.keys()].filter((d) => d <= today).sort();
  const bars: Bar[] = [];
  for (let date = known[0] ?? today; date <= today; date = addDays(date, 1)) {
    const kind = date === today ? "today" : "past";
    if (live.has(date)) bars.push({ date, kind, fires: live.get(date)!, source: "live" });
    else if (hist.has(date)) bars.push({ date, kind, fires: hist.get(date)!, source: "history" });
    else bars.push({ date, kind, fires: null, source: "none" });
  }
  const ahead = [...new Set(smoke.times.map((t) => sgDate(0, new Date(t))))].filter((d) => d > today).sort();
  for (const date of ahead) bars.push({ date, kind: "forecast", fires: null, source: "live" });
  return bars;
}

/**
 * The first date PSI passes 100 and 200, in date order. Uses the index's daily maximum, with the live `psiDaily`
 * overriding it for the same date; "first" is the earliest date in the whole range.
 */
export function eventMarks(index: HistoryIndex | null, psiDaily: DayPsi[]): Mark[] {
  const psi = new Map<string, number>();
  for (const d of index?.days ?? []) if (d.psiMax != null) psi.set(d.date, d.psiMax);
  for (const d of psiDaily) psi.set(d.date, d.max);
  const sorted = [...psi].sort(([a], [b]) => (a < b ? -1 : 1));
  const marks: Mark[] = [];
  for (const { above, label } of MARKS) {
    const hit = sorted.find(([, v]) => v > above);
    if (hit) marks.push({ date: hit[0], label });
  }
  return marks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The ISO (UTC) times a bar can show: today and forecast bars the smoke steps inside that SGT date; a past day from history its
 * 8 steps (00, 03, ... 21 SGT); a past live day the single air arrival at ARRIVAL_SGT; a gap none.
 */
export function stepsOf(bar: Bar, smoke: SmokeGrid): string[] {
  if (bar.kind !== "past") return smoke.times.filter((t) => sgDate(0, new Date(t)) === bar.date);
  if (bar.source === "history") return SGT_STEPS.map((h) => sgtIso(bar.date, h));
  if (bar.source === "live") return [sgtIso(bar.date, ARRIVAL_SGT)];
  return [];
}
