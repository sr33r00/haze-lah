import type { Accuracy } from "./accuracy";
import { fmtHour, fmtHourRange, fmtWeekday } from "./format";
import { HIGH_PM25 } from "./forecast";
import type { ForecastPoint, HourPoint, OutlookStep, WeatherHour } from "./types";
import { hourKey, sgDate, sgHour } from "./util";

const HOUR = 3600_000;

/** One hour of the forecast instrument: what was measured, what is forecast, the rain chance and (every 3 h) the wind. */
export type InstrumentHour = {
  t: string; // ISO, on the hour
  observed: number | null; // NEA 1-hr PM2.5 measured that hour
  pm25: number | null; // corrected forecast
  low: number | null;
  high: number | null;
  raw: number | null; // CAMS model value
  pHigh: number | null; // chance of going above 55, 0 to 1
  rainProb: number | null;
  wind: OutlookStep | null; // set only on hours where an outlook step starts
};

/**
 * The hourly series behind the 48-hour instrument: the last `pastHours` measured hours then the first `aheadHours`
 * forecast hours, joined with rain and the 3-hourly wind outlook on one sorted hourly axis.
 */
export function instrumentHours(
  observed: HourPoint[],
  forecast: ForecastPoint[],
  weather: WeatherHour[],
  outlook: OutlookStep[] | null,
  pastHours = 12,
  aheadHours = 48,
): InstrumentHour[] {
  const rain = new Map(weather.map((w) => [hourKey(w.time), w.rainProb]));
  const wind = new Map((outlook ?? []).map((o) => [hourKey(o.t), o]));
  const rows = new Map<string, InstrumentHour>();
  const row = (time: string) => {
    const t = hourKey(time);
    let r = rows.get(t);
    if (!r) {
      r = { t, observed: null, pm25: null, low: null, high: null, raw: null, pHigh: null, rainProb: rain.get(t) ?? null, wind: wind.get(t) ?? null };
      rows.set(t, r);
    }
    return r;
  };
  const byTime = <T extends { time: string }>(xs: T[]) => [...xs].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  for (const o of pastHours > 0 ? byTime(observed).slice(-pastHours) : []) row(o.time).observed = o.value;
  for (const f of byTime(forecast).slice(0, aheadHours)) Object.assign(row(f.time), { pm25: f.pm25, low: f.low, high: f.high, raw: f.raw, pHigh: f.pHigh });
  return [...rows.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

/** The highest forecast hour (measured-only hours are ignored), or null without a forecast. */
export function peakAhead(hours: InstrumentHour[]): { t: string; pm25: number } | null {
  let peak: { t: string; pm25: number } | null = null;
  for (const h of hours) if (h.pm25 != null && (!peak || h.pm25 > peak.pm25)) peak = { t: h.t, pm25: h.pm25 };
  return peak;
}

/**
 * The best stretch of daylight (SGT hour from `fromHour` up to, not including, `toHour`): the run of at least `minLen`
 * consecutive forecast hours, all at or under 55, with the lowest maximum (the earliest on a tie), widened to every
 * neighbouring daylight hour that stays at or under that maximum. `to` is the end of the last hour.
 */
export function bestWindow(hours: InstrumentHour[], fromHour = 7, toHour = 19, minLen = 3): { from: string; to: string; max: number } | null {
  const day = hours.filter((h) => h.pm25 != null && sgHour(h.t) >= fromHour && sgHour(h.t) < toHour);
  // Split the daylight hours into stretches with no gap.
  const stretches: InstrumentHour[][] = [];
  for (const h of day) {
    const last = stretches[stretches.length - 1];
    if (last && Date.parse(h.t) - Date.parse(last[last.length - 1].t) === HOUR) last.push(h);
    else stretches.push([h]);
  }
  let best: { s: InstrumentHour[]; i: number; max: number } | null = null;
  for (const s of stretches) {
    for (let i = 0; i + minLen <= s.length; i++) {
      const max = Math.max(...s.slice(i, i + minLen).map((h) => h.pm25!));
      if (max <= HIGH_PM25 && (!best || max < best.max)) best = { s, i, max };
    }
  }
  if (!best) return null;
  const { s, max } = best;
  let a = best.i;
  let b = best.i + minLen - 1;
  while (a > 0 && s[a - 1].pm25! <= max) a--;
  while (b < s.length - 1 && s[b + 1].pm25! <= max) b++;
  return { from: s[a].t, to: new Date(Date.parse(s[b].t) + HOUR).toISOString(), max };
}

/** "today", "tomorrow" or the weekday of a moment, counted from `now`, in Singapore. */
function dayWord(t: string, now: Date) {
  const date = sgDate(0, new Date(t));
  return date === sgDate(0, now) ? "today" : date === sgDate(1, now) ? "tomorrow" : fmtWeekday(date, "long");
}

/** The sentence that opens the forecast page: when the next 48 hours peak and the best daylight window. */
export function answerText(
  peak: { t: string; pm25: number } | null,
  window: { from: string; to: string } | null,
  now: Date,
): { headline: string; detail: string } {
  return {
    headline: peak ? `Worst ${dayWord(peak.t, now)} around ${fmtHour(peak.t)}, near ${peak.pm25} µg/m³.` : "No forecast for the next 48 hours.",
    detail: window ? `Best window: ${dayWord(window.from, now)} ${fmtHourRange(window.from, window.to)}.` : "No clear window in the next 48 hours.",
  };
}

/** Mean absolute error (µg/m³) of this forecast, Copernicus and "assuming no change" at one lead time in hours. */
export type SkillRow = { lead: number; ours: number; cams: number; persistence: number };

/** The scored leads that have at least `minN` forecasts and an error for all three methods; empty without a file. */
export function skillRows(a: Accuracy | null, minN = 20): SkillRow[] {
  const rows: SkillRow[] = [];
  for (const l of a?.leads ?? []) {
    const { ours, cams, persistence } = { ours: l.ours.mae, cams: l.cams.mae, persistence: l.persistence.mae };
    if (l.ours.n >= minN && ours != null && cams != null && persistence != null) rows.push({ lead: l.lead, ours, cams, persistence });
  }
  return rows;
}

/** Where this forecast starts to beat both Copernicus and "assuming no change", in plain words, or null without rows. */
export function skillSentence(rows: SkillRow[]): string | null {
  if (!rows.length) return null;
  const win = rows.findIndex((r) => r.ours < r.persistence && r.ours < r.cams);
  if (win < 0) return "Assuming no change is the better guide at every lead time tested so far.";
  if (rows.every((r) => r.ours < r.persistence && r.ours < r.cams)) return "This forecast beats Copernicus and assuming no change at every lead time.";
  const beats = `From ${rows[win].lead} hours ahead, this forecast beats both Copernicus and assuming no change.`;
  return win > 0 ? `For the next ${rows[win - 1].lead} hours, today's reading is the better guide. ${beats}` : beats;
}
