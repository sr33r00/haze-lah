import { pm25Step, verdictFor, type Group, type Verdict } from "./bands";
import type { ForecastPoint } from "./types";

export type PlanHour = { time: string; pm25: number; verdict: Verdict };

/** The next 24 forecast hours with a verdict for the group, from NEA's 1-hr PM2.5 guide. */
export const planHours = (hourly: ForecastPoint[], group: Group): PlanHour[] =>
  hourly.slice(0, 24).map((p) => ({ time: p.time, pm25: p.pm25, verdict: verdictFor(pm25Step(p.pm25, group)) }));
