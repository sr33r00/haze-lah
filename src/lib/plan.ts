import { pm25Step, verdictFor, type Group, type Verdict } from "./bands";
import type { ForecastPoint } from "./types";
import { sgHour } from "./util";

export type PlanHour = { time: string; pm25: number; verdict: Verdict };
export type Window = { start: string; end: string; startIndex: number; meanPm25: number; verdict: Verdict };

const LEN = 3;

/** The next 24 forecast hours with a verdict for the group, from NEA's 1-hr PM2.5 guide. */
export const planHours = (hourly: ForecastPoint[], group: Group): PlanHour[] =>
  hourly.slice(0, 24).map((p) => ({ time: p.time, pm25: p.pm25, verdict: verdictFor(pm25Step(p.pm25, group)) }));

/** Best 3-hour window starting 6am to 7pm Singapore time, by lowest mean PM2.5. */
export function bestWindow(hours: PlanHour[], group: Group): Window | null {
  let best: Window | null = null;
  for (let i = 0; i + LEN <= hours.length; i++) {
    const h = sgHour(hours[i].time);
    if (h < 6 || h > 19) continue;
    const mean = hours.slice(i, i + LEN).reduce((a, p) => a + p.pm25, 0) / LEN;
    if (!best || mean < best.meanPm25) {
      const end = new Date(Date.parse(hours[i].time) + LEN * 3600_000).toISOString();
      best = { start: hours[i].time, end, startIndex: i, meanPm25: mean, verdict: verdictFor(pm25Step(mean, group)) };
    }
  }
  return best;
}
