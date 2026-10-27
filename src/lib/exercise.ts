import { BREATH_M3_PER_DAY, NORMAL_PM25 } from "./breath";
import { cigarettes, PM25_PER_CIGARETTE } from "./cigarettes";
import { PM25_BANDS, pm25Band, pm25Step, verdictFor, type Group } from "./bands";
import { fromHour } from "./forecast";
import { fmtHour, fmtHourRange, fmtTime, fmtTimeRange } from "./format";
import { UV_VERY_HIGH } from "./outdoor";
import type { ForecastPoint, WeatherHour } from "./types";
import { hourKey, sgDate, sgHour } from "./util";

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

/** `tone` says how mild the answer is; the air-level colours are for the air alone, so an answer that comes from the weather has a `cause` (drawn in the rain's or the UV's own colour) instead. */
export type Rating = { tone: "go" | "easy" | "limit" | "stay"; text: string; cause?: "rain" | "uv" };
/** Fine to do outdoors, if gently. */
export const isOk = (r: Rating) => r.tone === "go" || r.tone === "easy";

const TONES: Rating["tone"][] = ["go", "easy", "limit", "stay"];

/** The harshest of the ratings; on a tie the earlier one, so the order passed is the order the words win in. */
export function worstRating(first: Rating, ...rest: Rating[]): Rating {
  return rest.reduce((w, r) => (TONES.indexOf(r.tone) > TONES.indexOf(w.tone) ? r : w), first);
}

/** The chance of rain (%) from which an hour counts as rainy. */
export const RAIN_LIKELY = 50;
export const RAIN_TEXT = "Rain likely";

/**
 * What the weather of an hour says about an activity, beyond the air: rain at a 50% chance or more is a "limit" for all of them;
 * UV from 8 (WHO: Very high) is a "limit" for strenuous activities and kids' play, and for going out a nudge to find shade.
 * Empty when the weather is fine or unknown.
 */
export function weatherRatings(w: Pick<WeatherHour, "rainProb" | "uv"> | undefined, activity: Activity): Rating[] {
  const out: Rating[] = [];
  if ((w?.rainProb ?? 0) >= RAIN_LIKELY) out.push({ tone: "limit", text: RAIN_TEXT, cause: "rain" });
  if ((w?.uv ?? 0) >= UV_VERY_HIGH) out.push(ACTIVITY[activity].strenuous ? { tone: "limit", text: "Very high UV", cause: "uv" } : { tone: "easy", text: "Very high UV, find shade", cause: "uv" });
  return out;
}

/** The weather of the hour that starts at `time`, from a list that may hold older hours or none at all. */
const weatherIndex = (weather: WeatherHour[]) => {
  const byHour = new Map(weather.map((w) => [hourKey(w.time), w]));
  return (time: string) => byHour.get(hourKey(time));
};

/**
 * `pm25` is the weighted mean, `worst` the highest hour; `dustUg` is the fine dust breathed and `timesNormal` the mean against a normal day.
 * `rating` is the worst of the air, the rain and the UV in the session. `rainProb`, `uv` and `feelsLike` are the session's highest, null without a forecast.
 */
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
  rainProb: number | null;
  uv: number | null;
  feelsLike: number | null;
  rating: Rating;
};

/** Shown under the plan: how the best time, the advice, the dust and the cigarettes are worked out. */
export const PLAN_NOTES = [
  "Best time is the session with the mildest rating for air, rain and UV. Among those, the one whose worst likely hour (the top of the forecast range) is lowest wins, then the lower average.",
  "The advice uses NEA's 1-hr PM2.5 guide on that worst hour.",
  `Rain (Open-Meteo forecast) counts against an hour from a ${RAIN_LIKELY}% chance. UV from ${UV_VERY_HIGH} is Very high on the WHO scale: strenuous outings and kids' play avoid it, and going out suggests shade. The worst of air, rain and UV sets the colour. Feels like is for information.`,
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
 * The steadiest session today (from now) and tomorrow: the start with the mildest rating (the worst of air, rain and UV in it), then
 * the lowest worst likely hour (highest `high`), then the lower weighted mean PM2.5, then the cooler feels-like, then the earlier start.
 * `startIndex` counts from the current hour. A final part-hour counts by its fraction. Without `weather` only the air counts.
 */
export function bestSlots(forecast: ForecastPoint[], activity: Activity, group: Group, now = Date.now(), hours = ACTIVITY[activity].hours, weather: WeatherHour[] = []): Slot[] {
  const a = ACTIVITY[activity];
  const wx = weatherIndex(weather);
  const maxOf = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.max(...v) : null;
  };
  const hourly = fromHour(forecast, now);
  const weights = Array.from({ length: Math.ceil(hours) }, (_, k) => Math.min(1, hours - k));
  const days = [sgDate(0, new Date(now)), sgDate(1, new Date(now))];
  const out: Slot[] = [];
  days.forEach((date, d) => {
    let best: { slot: Slot; likely: number } | null = null;
    const rank = (r: Rating) => TONES.indexOf(r.tone);
    for (let i = 0; i + weights.length <= hourly.length; i++) {
      const t = hourly[i].time;
      const h = sgHour(t);
      if (sgDate(0, new Date(t)) !== date || h < a.from || h > a.to) continue;
      const run = hourly.slice(i, i + weights.length);
      if (run.some((p, k) => Date.parse(p.time) !== Date.parse(t) + k * 3600_000)) continue;
      const pm = run.reduce((s, p, k) => s + p.pm25 * weights[k], 0) / hours;
      const likely = Math.max(...run.map((p) => p.high));
      const worst = Math.max(...run.map((p) => p.pm25));
      const wxRun = run.map((p) => wx(p.time));
      const rating = worstRating(rate(worst, activity, group), ...wxRun.flatMap((w) => weatherRatings(w, activity)));
      const feelsLike = maxOf(wxRun.map((w) => w?.feelsLike));
      if (best) {
        const b = best.slot;
        const worse =
          rank(rating) - rank(b.rating) ||
          likely - best.likely ||
          pm - b.pm25 ||
          (feelsLike != null && b.feelsLike != null ? feelsLike - b.feelsLike : 0);
        if (worse >= 0) continue;
      }
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
          rainProb: maxOf(wxRun.map((w) => w?.rainProb)),
          uv: maxOf(wxRun.map((w) => w?.uv)),
          feelsLike,
          rating,
        },
      };
    }
    if (best) out.push(best.slot);
  });
  return out;
}

/** One bar of the plan's hour strip: the forecast PM2.5, how the chosen activity rates in it (air, rain and UV together), the tone of the air alone (the bar's colour) and the rain chance. */
export type StripHour = { time: string; pm25: number; rating: Rating; air: Rating["tone"]; rainProb: number | null; rainy: boolean; uvHigh: boolean };

/** How far ahead Plan your day looks, in hours: the forecast's error grows with lead time (`accuracy.json`). */
export const PLAN_HOURS = 16;

/**
 * The hours to plan in: from the current hour (`fromHour`) for `PLAN_HOURS`. Each hour carries the activity's own rating.
 */
export function planStrip(hourly: ForecastPoint[], activity: Activity, group: Group, now = Date.now(), weather: WeatherHour[] = []): StripHour[] {
  const wx = weatherIndex(weather);
  return fromHour(hourly, now)
    .slice(0, PLAN_HOURS)
    .map((p) => {
      const w = wx(p.time);
      const air = rate(p.pm25, activity, group);
      return {
        time: p.time,
        pm25: p.pm25,
        rating: worstRating(air, ...weatherRatings(w, activity)),
        air: air.tone,
        rainProb: w?.rainProb ?? null,
        rainy: (w?.rainProb ?? 0) >= RAIN_LIKELY,
        uvHigh: (w?.uv ?? 0) >= UV_VERY_HIGH,
      };
    });
}

/** The hours of a session as a range, "7–10am"; with minutes ("3:30–5pm") when it ends on the half hour. SGT is a whole-hour offset, so UTC minutes are local minutes. */
export const fmtSlot = (s: Pick<Slot, "start" | "end">) => (new Date(s.end).getUTCMinutes() ? fmtTimeRange : fmtHourRange)(s.start, s.end);

/**
 * The best session for the chosen activity inside the plan's `strip` of hours (see `planStrip`), the only window Plan your day looks at:
 * further ahead the forecast is less sure. Plan your day and the Now page's best-time line both read it, so they always agree.
 */
export function planSlot(hourly: ForecastPoint[], strip: StripHour[], activity: Activity, group: Group, now: number, hours: number, weather: WeatherHour[]): Slot | undefined {
  const until = strip.length ? Date.parse(strip[0].time) + strip.length * 3600_000 : 0;
  return bestSlots(hourly.filter((p) => Date.parse(p.time) < until), activity, group, now, hours, weather)[0];
}

/**
 * The Now page's two-line answer to "when should I {activity}?". `text`: "Cleanest air to run: now till 8am" when the session starts in the
 * current hour, otherwise "Cleanest air to run: today 6–7am" (or "tomorrow"). It is relative, so it reads the same for a fine slot and a poor one;
 * `detail` says how good it is: "PM2.5 about 45 · Normal" (the session's mean and its NEA 1-hr band).
 */
export function bestTimeLine(slot: Slot, activity: Activity, now: number): { text: string; detail: string } {
  const when =
    slot.startIndex === 0 || Date.parse(slot.start) <= now
      ? `now till ${(new Date(slot.end).getUTCMinutes() ? fmtTime : fmtHour)(slot.end)}`
      : `${slot.day} ${fmtSlot(slot)}`;
  return { text: `Cleanest air to ${ACTIVITY[activity].phrase}: ${when}`, detail: `PM2.5 about ${Math.round(slot.pm25)} · ${pm25Band(slot.pm25).name}` };
}

/** The lowest PM2.5 of each NEA 1-hr band (I to IV), to read the ratings off. */
const BAND_PM25 = PM25_BANDS.map((_, i) => (i ? PM25_BANDS[i - 1].max + 1 : 0));

/** The distinct answers the chosen activity can give, mildest first. Each air answer lists every colour it is drawn in; a weather answer has none, only its `cause`. */
export function ratingLegend(activity: Activity, group: Group): { text: string; tones: Rating["tone"][]; cause?: Rating["cause"] }[] {
  const out: { text: string; tones: Rating["tone"][]; cause?: Rating["cause"] }[] = [];
  for (const pm of BAND_PM25) {
    const r = rate(pm, activity, group);
    const item = out.find((o) => o.text === r.text);
    if (!item) out.push({ text: r.text, tones: [r.tone] });
    else if (!item.tones.includes(r.tone)) item.tones.push(r.tone);
  }
  // Then the weather's answers, once each (the worst case of both).
  for (const r of weatherRatings({ rainProb: 100, uv: 11 }, activity)) out.push({ text: r.text, tones: [], cause: r.cause });
  return out;
}

/** The weather and air behind a session's answer, as a short line: "Dry · UV 3 · Air normal". Parts without a forecast are left out. */
export function slotReason(slot: Slot): string {
  const rain = slot.rainProb == null ? null : slot.rainProb >= RAIN_LIKELY ? RAIN_TEXT : slot.rainProb >= 20 ? `Rain ${Math.round(slot.rainProb)}%` : "Dry";
  const uv = slot.uv == null ? null : `UV ${Math.round(slot.uv)}`;
  return [rain, uv, `Air ${pm25Band(slot.worst).name.toLowerCase()}`].filter(Boolean).join(" · ");
}
