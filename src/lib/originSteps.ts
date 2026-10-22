import { latestFireDay } from "./history";
import type { Replay, SmokeGrid } from "./types";

/**
 * One stop of the Now map's time slider. `day` indexes the replay day whose path, fires and wind it shows; `frame` indexes the live
 * smoke grid's time step whose PM2.5 it shows. A past step has none (the grid starts at the present): its PM2.5 is the history file's.
 */
export type OriginStep = { t: string; kind: "past" | "now" | "ahead"; day: number; frame: number | null };

const HOUR = 3600_000;
const FRAME_REACH = 1.5 * HOUR; // half the grid's 3 h step: a time this close to a step is that step

/** The index of the grid's step at `t` (ISO), or null when none is within half a step (the history files have the same 3-hour steps). */
export function frameAt(smoke: Pick<SmokeGrid, "times"> | null, t: string): number | null {
  if (!smoke) return null;
  let best: number | null = null;
  smoke.times.forEach((s, i) => {
    const d = Math.abs(Date.parse(s) - Date.parse(t));
    if (d <= FRAME_REACH && (best == null || d < Math.abs(Date.parse(smoke.times[best]) - Date.parse(t)))) best = i;
  });
  return best;
}

/**
 * The slider's stops, oldest first: each earlier replay day at the time its air reached Singapore, then "now" and the smoke grid's
 * 3-hour steps to 3 days ahead. The newest replay day is today, and shares its path, fires and wind with all of those. Until the grid
 * arrives (`smoke` null) there is just "now", at `now` (ms). Pure.
 */
export function originSteps(replay: Replay, smoke: SmokeGrid | null, now = Date.now()): OriginStep[] {
  const today = replay.days.length - 1;
  const past = replay.days.slice(0, today).map((d, i): OriginStep => ({ t: d.arrival, kind: "past", day: i, frame: null }));
  const ahead = smoke?.times.length
    ? smoke.times.map((t, i): OriginStep => ({ t, kind: i === 0 ? "now" : "ahead", day: today, frame: i }))
    : [{ t: new Date(now).toISOString(), kind: "now" as const, day: today, frame: null }];
  return [...past, ...ahead];
}

/**
 * The index in `days` (oldest first) of the day whose fires the map shows for the step on day `k`. A past step shows its own day. Now and
 * the forecast show the newest day up to `k` with enough fires (the first hours of a day have few, a failed pass none), as the globe does.
 */
export function fireDayAt(days: { fires: unknown[] }[], k: number, past: boolean): number {
  const shown = past ? undefined : latestFireDay(days.slice(0, k + 1));
  return shown ? days.indexOf(shown) : k;
}
