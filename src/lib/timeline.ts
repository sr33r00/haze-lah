import type { HistoryIndex } from "./historyTypes";
import { ARRIVAL_SGT } from "./replay";
import type { DayPsi, Replay, SmokeGrid } from "./types";
import { sgDate, sgHour, shiftDate, sgtTime } from "./util";

/** One day of the globe's timeline. `source` says where its fires came from: the live replay, the history index, or neither (a gap). */
export type Bar = { date: string; kind: "past" | "today" | "forecast"; fires: number | null; source: "history" | "live" | "none" };

/** A timeline event: the first day PSI passes a threshold. */
export type Mark = { date: string; label: string };

/** NEA 24-hr PSI bands: above 100 is Unhealthy, above 200 Very unhealthy (NEA, https://www.haze.gov.sg/the-haze-situation/psi-readings-and-air-quality). */
const MARKS = [
  { above: 100, label: "PSI 100+" },
  { above: 200, label: "PSI 200+" },
];

const SGT_STEPS = [0, 3, 6, 9, 12, 15, 18, 21];

/** The ISO UTC time of `hour` o'clock SGT on SGT `date`. */
const sgtIso = (date: string, hour: number) => new Date(sgtTime(date, hour)).toISOString();

/**
 * The timeline's days, oldest first: from the first date known (history or replay) to today, then the forecast dates in `smoke.times`.
 * A date the index lists takes its fires from the index: its day file is complete and final, while the live replay's oldest day
 * has lost its night pass to FIRMS's window. The live replay fills the dates the index does not have yet (today, and the days
 * before the daily job has run); a date between the first known one and today with neither is a gap (`source: "none"`).
 * Nothing is filled before the first known date. Pure.
 */
export function buildBars(index: HistoryIndex | null, replay: Replay, smoke: SmokeGrid, today: string): Bar[] {
  const hist = new Map((index?.days ?? []).map((d) => [d.date, d.fires]));
  const live = new Map(replay.days.map((d) => [d.date, d.total]));
  const known = [...hist.keys(), ...live.keys()].filter((d) => d <= today).sort();
  const bars: Bar[] = [];
  for (let date = known[0] ?? today; date <= today; date = shiftDate(date, 1)) {
    const kind = date === today ? "today" : "past";
    if (hist.has(date)) bars.push({ date, kind, fires: hist.get(date)!, source: "history" });
    else if (live.has(date)) bars.push({ date, kind, fires: live.get(date)!, source: "live" });
    else bars.push({ date, kind, fires: null, source: "none" });
  }
  const ahead = [...new Set(smoke.times.map((t) => sgDate(0, new Date(t))))].filter((d) => d > today).sort();
  for (const date of ahead) bars.push({ date, kind: "forecast", fires: null, source: "live" });
  return bars;
}

/** Singapore's highest 24-hr PSI by SGT date: the history index's, with the live `psiDaily` overriding it for the same date. */
export function psiByDate(index: HistoryIndex | null, psiDaily: DayPsi[]): Map<string, number> {
  const psi = new Map<string, number>();
  for (const d of index?.days ?? []) if (d.psiMax != null) psi.set(d.date, d.psiMax);
  for (const d of psiDaily) psi.set(d.date, d.max);
  return psi;
}

/**
 * The first date PSI passes 100 and 200, in date order. Uses the index's daily maximum, with the live `psiDaily`
 * overriding it for the same date; "first" is the earliest date in the whole range.
 */
export function eventMarks(index: HistoryIndex | null, psiDaily: DayPsi[]): Mark[] {
  const sorted = [...psiByDate(index, psiDaily)].sort(([a], [b]) => (a < b ? -1 : 1));
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
  if (bar.kind !== "past") {
    const steps = smoke.times.filter((t) => sgDate(0, new Date(t)) === bar.date);
    return steps.length || bar.kind === "forecast" ? steps : [sgtIso(bar.date, ARRIVAL_SGT)]; // today without a smoke forecast still has its air path
  }
  if (bar.source === "history") return SGT_STEPS.map((h) => sgtIso(bar.date, h));
  if (bar.source === "live") return [sgtIso(bar.date, ARRIVAL_SGT)];
  return [];
}

/** Where the viewer is on the timeline: a bar's date and the index of one of that bar's steps (`stepsOf` lists them). */
export type Sel = { date: string; step: number };

/** What a bar offers as steps. The timeline's callers decide (a past day with a history file has 8). */
type Steps = (bar: Bar) => string[];

/** The index of the step in `steps` (ISO times) closest to time `t` (ms); 0 for none. */
export function nearestStep(steps: string[], t: number): number {
  let best = 0;
  steps.forEach((s, i) => {
    if (Math.abs(Date.parse(s) - t) < Math.abs(Date.parse(steps[best]) - t)) best = i;
  });
  return best;
}

/** The selection on `bar` at the step nearest `hour` o'clock SGT. */
export const selectAt = (bar: Bar, steps: string[], hour: number): Sel => ({ date: bar.date, step: nearestStep(steps, sgtTime(bar.date, hour)) });

/** The SGT hour of the selected step. */
const hourOf = (steps: string[], sel: Sel) => sgHour(steps[sel.step] ?? steps[0]);

/** The nearest bar from `i` in direction `dir` that has steps (gaps are skipped), or -1. */
function neighbour(bars: Bar[], steps: Steps, i: number, dir: 1 | -1): number {
  for (let j = i + dir; j >= 0 && j < bars.length; j += dir) if (steps(bars[j]).length) return j;
  return -1;
}

/** One bar earlier or later at the same time of day (the step nearest it), skipping gaps. Null at either end. */
export function moveDay(bars: Bar[], steps: Steps, sel: Sel, dir: 1 | -1): Sel | null {
  const i = bars.findIndex((b) => b.date === sel.date);
  const j = i < 0 ? -1 : neighbour(bars, steps, i, dir);
  return j < 0 ? null : selectAt(bars[j], steps(bars[j]), hourOf(steps(bars[i]), sel));
}

/** One step earlier or later; past the first or last step of a bar it goes to the neighbouring bar's last or first. Null at either end. */
export function moveStep(bars: Bar[], steps: Steps, sel: Sel, dir: 1 | -1): Sel | null {
  const i = bars.findIndex((b) => b.date === sel.date);
  if (i < 0) return null;
  const own = steps(bars[i]);
  const k = sel.step + dir;
  if (k >= 0 && k < own.length) return { date: sel.date, step: k };
  const j = neighbour(bars, steps, i, dir);
  return j < 0 ? null : { date: bars[j].date, step: dir > 0 ? 0 : steps(bars[j]).length - 1 };
}

/**
 * What playing shows next: the next 3-hour step within today and forecast days, then the first step of the next bar; past days
 * go one bar at a time at the same time of day. Null at the end.
 */
export function playNext(bars: Bar[], steps: Steps, sel: Sel): Sel | null {
  const i = bars.findIndex((b) => b.date === sel.date);
  if (i < 0) return null;
  const own = steps(bars[i]);
  if (bars[i].kind !== "past" && sel.step + 1 < own.length) return { date: sel.date, step: sel.step + 1 };
  const j = neighbour(bars, steps, i, 1);
  if (j < 0) return null;
  return bars[j].kind === "past" ? selectAt(bars[j], steps(bars[j]), hourOf(own, sel)) : { date: bars[j].date, step: 0 };
}
