import { BREATH_M3_PER_DAY, NORMAL_PM25 } from "./breath";
import { cigarettes, PM25_PER_CIGARETTE } from "./cigarettes";
import { PM25_BANDS, pm25Band, pm25Step, verdictFor, type Group } from "./bands";
import { fromHour } from "./forecast";
import type { ForecastPoint } from "./types";
import { sgDate, sgHour } from "./util";

export type Activity = "out" | "run" | "cycle" | "play" | "football";

/**
 * How long each activity usually takes, when people start it (hours, SGT) and the air breathed, m³ an hour.
 * Air: US EPA, Exposure Factors Handbook (2011), Chapter 6, Table 6-2 (mean, m³/min × 60), by EPA's MET bands:
 * light (1.5 to 3) 1.2E-02 for adults, high (over 6) 4.9E-02 for adults aged 31 to under 41,
 * moderate (3 to 6) 2.7E-02 for adults and 2.2E-02 for children aged 6 to under 11.
 * `phrase` completes "I want to ...".
 */
export const ACTIVITY: Record<Activity, { phrase: string; hours: number; from: number; to: number; strenuous: boolean; m3PerHour: number }> = {
  out: { phrase: "go out", hours: 3, from: 7, to: 19, strenuous: false, m3PerHour: 0.72 },
  run: { phrase: "run", hours: 1, from: 5, to: 21, strenuous: true, m3PerHour: 2.94 },
  cycle: { phrase: "cycle", hours: 2, from: 6, to: 18, strenuous: true, m3PerHour: 1.62 },
  play: { phrase: "take the kids out to play", hours: 1, from: 7, to: 18, strenuous: true, m3PerHour: 1.32 },
  football: { phrase: "play football", hours: 1.5, from: 7, to: 20, strenuous: true, m3PerHour: 2.94 },
};
/** Session lengths offered, in hours. Covers every activity's usual length. */
export const DURATIONS = [0.5, 1, 1.5, 2, 3];
export const ACTIVITIES = Object.keys(ACTIVITY) as Activity[];

export type Rating = { tone: "go" | "easy" | "limit" | "stay"; text: string };
/** Fine to do outdoors, if gently. */
export const isOk = (r: Rating) => r.tone === "go" || r.tone === "easy";

/** `pm25` is the weighted mean, `worst` the highest hour; `dustUg` is the fine dust breathed and `timesNormal` the mean against a normal day. */
export type Slot = {
  day: "today" | "tomorrow";
  start: string;
  end: string;
  startIndex: number;
  pm25: number;
  worst: number;
  dustUg: number;
  cigarettes: number;
  timesNormal: number;
  rating: Rating;
};

/** Shown under the plan: how the best time, the advice, the dust and the cigarettes are worked out. */
export const PLAN_NOTES = [
  "Best time is the session whose worst likely hour (the top of the forecast range) is lowest. If two tie, the lower average wins.",
  "The advice uses NEA's 1-hr PM2.5 guide on that worst hour.",
  `Fine dust breathed is PM2.5 × air breathed × time. The air comes from US EPA tables by effort: hard exercise means more air, and mouth breathing skips the nose's filter.`,
  `Cigarettes: ${PM25_PER_CIGARETTE} µg/m³ for 24 hours carries about the same risk of early death as one cigarette (Berkeley Earth). The session's dust is shared over a day's ${BREATH_M3_PER_DAY} m³ of air. It compares risk, not smoke, and is a rough illustration. A normal day is ${NORMAL_PM25} µg/m³.`,
];

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

/**
 * The steadiest session today (from now) and tomorrow: the start whose worst likely hour (highest `high`) is lowest,
 * then the lower weighted mean PM2.5, then the earlier start. `startIndex` counts from the current hour. A final part-hour counts by its fraction.
 */
export function bestSlots(forecast: ForecastPoint[], activity: Activity, group: Group, now = Date.now(), hours = ACTIVITY[activity].hours): Slot[] {
  const a = ACTIVITY[activity];
  const hourly = fromHour(forecast, now);
  const weights = Array.from({ length: Math.ceil(hours) }, (_, k) => Math.min(1, hours - k));
  const days = [sgDate(0, new Date(now)), sgDate(1, new Date(now))];
  const out: Slot[] = [];
  days.forEach((date, d) => {
    let best: { slot: Slot; likely: number } | null = null;
    for (let i = 0; i + weights.length <= hourly.length; i++) {
      const t = hourly[i].time;
      const h = sgHour(t);
      if (sgDate(0, new Date(t)) !== date || h < a.from || h > a.to) continue;
      const run = hourly.slice(i, i + weights.length);
      if (run.some((p, k) => Date.parse(p.time) !== Date.parse(t) + k * 3600_000)) continue;
      const pm = run.reduce((s, p, k) => s + p.pm25 * weights[k], 0) / hours;
      const likely = Math.max(...run.map((p) => p.high));
      if (best && (likely > best.likely || (likely === best.likely && pm >= best.slot.pm25))) continue;
      const worst = Math.max(...run.map((p) => p.pm25));
      const dustUg = pm * hours * a.m3PerHour;
      best = {
        likely,
        slot: {
          day: d === 0 ? "today" : "tomorrow",
          start: t,
          end: new Date(Date.parse(t) + hours * 3600_000).toISOString(),
          startIndex: i,
          pm25: pm,
          worst,
          dustUg,
          cigarettes: cigarettes(dustUg / BREATH_M3_PER_DAY) ?? 0,
          timesNormal: pm / NORMAL_PM25,
          rating: rate(worst, activity, group),
        },
      };
    }
    if (best) out.push(best.slot);
  });
  return out;
}

/** One bar of the plan's hour strip: the forecast PM2.5 and how the chosen activity rates in it. */
export type StripHour = { time: string; pm25: number; rating: Rating };

/** How far ahead Plan your day looks, in hours: the forecast's error grows with lead time (data/accuracy.json). */
export const PLAN_HOURS = 16;

/**
 * The hours to plan in: from the current hour (`fromHour`) for `PLAN_HOURS`. Each hour carries the activity's own rating.
 */
export function planStrip(hourly: ForecastPoint[], activity: Activity, group: Group, now = Date.now()): StripHour[] {
  return fromHour(hourly, now)
    .slice(0, PLAN_HOURS)
    .map((p) => ({ time: p.time, pm25: p.pm25, rating: rate(p.pm25, activity, group) }));
}

/** The lowest PM2.5 of each NEA 1-hr band (I to IV), to read the ratings off. */
const BAND_PM25 = PM25_BANDS.map((_, i) => (i ? PM25_BANDS[i - 1].max + 1 : 0));

/** The distinct answers the chosen activity can give, mildest first, each with every colour it is drawn in. */
export function ratingLegend(activity: Activity, group: Group): { text: string; tones: Rating["tone"][] }[] {
  const out: { text: string; tones: Rating["tone"][] }[] = [];
  for (const pm of BAND_PM25) {
    const r = rate(pm, activity, group);
    const item = out.find((o) => o.text === r.text);
    if (!item) out.push({ text: r.text, tones: [r.tone] });
    else if (!item.tones.includes(r.tone)) item.tones.push(r.tone);
  }
  return out;
}
