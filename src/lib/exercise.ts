import { pm25Band, pm25Step, verdictFor, type Group } from "./bands";
import type { ForecastPoint } from "./types";
import { sgDate, sgHour } from "./util";

export type Activity = "out" | "run" | "cycle" | "play";

/** How long each activity takes and when people usually do it (start hours, SGT). */
export const ACTIVITY: Record<Activity, { label: string; hours: number; from: number; to: number; strenuous: boolean }> = {
  out: { label: "Going out", hours: 3, from: 7, to: 19, strenuous: false },
  run: { label: "Run", hours: 1, from: 5, to: 21, strenuous: true },
  cycle: { label: "Cycle", hours: 2, from: 6, to: 18, strenuous: true },
  play: { label: "Kids play", hours: 1, from: 7, to: 18, strenuous: true },
};
export const ACTIVITIES = Object.keys(ACTIVITY) as Activity[];

export type Rating = { tone: "go" | "easy" | "limit" | "stay"; text: string };
/** Fine to do outdoors, if gently. */
export const isOk = (r: Rating) => r.tone === "go" || r.tone === "easy";

export type Slot = { day: "today" | "tomorrow"; start: string; end: string; startIndex: number; pm25: number; rating: Rating };

/**
 * NEA's 1-hr PM2.5 personal guide: band I is fine for everyone; in band II healthy people reduce strenuous activity
 * and vulnerable people (children included) avoid it; from band III everyone avoids it. Going out uses the full
 * guide for the visitor's group.
 */
export function rate(pm: number, activity: Activity, group: Group): Rating {
  const a = ACTIVITY[activity];
  if (!a.strenuous) {
    const v = verdictFor(pm25Step(pm, group));
    return { tone: v.tone, text: v.headline.replace(/\.$/, "") };
  }
  const band = pm25Band(pm).index;
  const vulnerable = activity === "play" || group !== "healthy";
  if (band === 0) return { tone: "go", text: activity === "play" ? "Good for outdoor play" : "Good to go" };
  if (band === 1 && !vulnerable) return { tone: "easy", text: "Keep it short and easy" };
  return { tone: band >= 2 ? "stay" : "limit", text: activity === "play" ? "Play indoors instead" : "Better indoors" };
}

/** The cleanest slot today (from now) and tomorrow for an activity, by mean forecast PM2.5. */
export function bestSlots(hourly: ForecastPoint[], activity: Activity, group: Group, now = Date.now()): Slot[] {
  const a = ACTIVITY[activity];
  const days = [sgDate(0, new Date(now)), sgDate(1, new Date(now))];
  const out: Slot[] = [];
  days.forEach((date, d) => {
    let best: Slot | null = null;
    for (let i = 0; i + a.hours <= hourly.length; i++) {
      const t = hourly[i].time;
      const h = sgHour(t);
      if (sgDate(0, new Date(t)) !== date || h < a.from || h > a.to || Date.parse(t) < now - 3600_000) continue;
      const pm = hourly.slice(i, i + a.hours).reduce((s, p) => s + p.pm25, 0) / a.hours;
      if (!best || pm < best.pm25) {
        const end = new Date(Date.parse(t) + a.hours * 3600_000).toISOString();
        best = { day: d === 0 ? "today" : "tomorrow", start: t, end, startIndex: i, pm25: pm, rating: rate(pm, activity, group) };
      }
    }
    if (best) out.push(best);
  });
  return out;
}
