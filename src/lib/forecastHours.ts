import type { Accuracy } from "./accuracy";
import { windFrom, windFromShort } from "./context";
import { cap, fmtHour, fmtHourRange, fmtWeekday } from "./format";
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
export function dayWord(t: string, now: Date) {
  const date = sgDate(0, new Date(t));
  return date === sgDate(0, now) ? "today" : date === sgDate(1, now) ? "tomorrow" : fmtWeekday(date, "long");
}

/** The day's main wind direction (degrees the wind blows from, 0 to 359): the circular mean of that SGT day's outlook steps, or null without any. */
export function dayWind(outlook: OutlookStep[] | null, date: string): number | null {
  const steps = (outlook ?? []).filter((o) => sgDate(0, new Date(o.t)) === date);
  if (!steps.length) return null;
  const rad = (o: OutlookStep) => (o.deg * Math.PI) / 180;
  const x = steps.reduce((sum, o) => sum + Math.sin(rad(o)), 0);
  const y = steps.reduce((sum, o) => sum + Math.cos(rad(o)), 0);
  return (Math.round((Math.atan2(x, y) * 180) / Math.PI) + 360) % 360;
}

/** The latest measured value (µg/m³) in the hours, or null when none was measured. */
export function latestObserved(hours: InstrumentHour[]): number | null {
  return hours.findLast((h) => h.observed != null)?.observed ?? null;
}

/**
 * The sentences that open the forecast page. The headline is "Worst right now" when the latest measured value (`latest`) is
 * already at or above the forecast peak and over 55, "Normal air" when the whole forecast stays at or under 55, else when the
 * next 48 hours peak. The detail has the best daylight window (after the day's highest hour on a normal day) and ends with
 * `leadNote`, the short-lead clause from `shortLeadNote`, when there is one.
 */
export function answerText(
  peak: { t: string; pm25: number } | null,
  window: { from: string; to: string } | null,
  now: Date,
  latest: number | null = null,
  leadNote: string | null = null,
): { headline: string; detail: string } {
  const windowText = window ? `Best window: ${dayWord(window.from, now)} ${fmtHourRange(window.from, window.to)}.` : "No clear window in the next 48 hours.";
  let headline: string;
  let detail = windowText;
  if (!peak) headline = "No forecast for the next 48 hours.";
  else if (latest != null && latest > HIGH_PM25 && latest >= peak.pm25) headline = `Worst right now, near ${Math.round(latest)} µg/m³.`;
  else if (peak.pm25 <= HIGH_PM25) {
    headline = "Normal air for the next 48 hours.";
    detail = `Highest ${dayWord(peak.t, now)} around ${fmtHour(peak.t)}, near ${Math.round(peak.pm25)} µg/m³. ${windowText}`;
  } else headline = `Worst ${dayWord(peak.t, now)} around ${fmtHour(peak.t)}, near ${Math.round(peak.pm25)} µg/m³.`;
  return { headline, detail: leadNote ? `${detail} ${leadNote}` : detail };
}

/**
 * The readout for one hour, as lines: `when` (the time) and `figures` (PM2.5 with its likely range, the chance of passing 55;
 * each figure is one group that must not break) make `line1`; then the model's value and the wind; the fires it crosses;
 * the rain chance. A part with nothing to say is "". `long` spells the wind out ("from the southwest at 22 km/h") for a
 * screen reader; the default is short ("wind SW 22 km/h") so a line fits at 360 px.
 */
export function readoutLines(h: InstrumentHour, now = new Date(), long = false) {
  const when = `${cap(dayWord(h.t, now))} ${fmtHour(h.t)}`;
  const rain = h.rainProb != null ? `Rain ${Math.round(h.rainProb)}%` : "";
  if (h.pm25 == null) {
    const figures = h.observed != null ? [`Measured ${Math.round(h.observed)} µg/m³`] : [];
    return { when, figures, line1: [when, ...figures].join("  "), line2: "", fires: "", rain };
  }
  const range = h.low != null && h.high != null ? ` (${Math.round(h.low)}–${Math.round(h.high)})` : "";
  const figures = [`PM2.5 ${Math.round(h.pm25)}${range}`, ...(h.pHigh != null ? [`${Math.round(h.pHigh * 100)}% above ${HIGH_PM25}`] : [])];
  const w = h.wind;
  const wind = w && (long ? `from the ${windFrom(w.deg)} at ${w.kmh} km/h` : `wind ${windFromShort(w.deg)} ${w.kmh} km/h`);
  const line2 = [h.raw != null && `Copernicus ${Math.round(h.raw)}`, wind].filter(Boolean).join(", ");
  const fires = w && w.near > 0 ? `over ${w.near.toLocaleString("en-SG")} ${w.near === 1 ? "fire" : "fires"}${w.area ? ` in ${w.area}` : ""}` : "";
  return { when, figures, line1: [when, ...figures].join("  "), line2, fires, rain };
}

/** The readout as sentences, for a screen reader. */
export function readoutText(h: InstrumentHour, now?: Date) {
  const { line1, line2, fires, rain } = readoutLines(h, now, true);
  return [line1.replace(/ {2,}/g, ", "), [line2, fires].filter(Boolean).join(", "), rain].filter(Boolean).join(". ");
}

/** Mean absolute error (µg/m³) of this forecast, Copernicus and "assuming no change" at one lead time in hours. */
export type SkillRow = { lead: number; ours: number; cams: number; persistence: number };

/** The scored leads that have at least `minN` forecasts and an error for all three methods; empty without a file. */
export function skillRows(a: Accuracy | null, minN = 20): SkillRow[] {
  const rows: SkillRow[] = [];
  for (const l of a?.leads ?? []) {
    const [ours, cams, persistence] = [l.ours.mae, l.cams.mae, l.persistence.mae];
    if (l.ours.n >= minN && ours != null && cams != null && persistence != null) rows.push({ lead: l.lead, ours, cams, persistence });
  }
  return rows;
}

/** True when this forecast is closer than both Copernicus and "assuming no change" at this lead. */
const beatsBoth = (r: SkillRow) => r.ours < r.persistence && r.ours < r.cams;

/** True when "assuming no change" is at least as close as this forecast at this lead. */
const losesToNoChange = (r: SkillRow) => r.ours >= r.persistence;

/**
 * The short-lead clause for the forecast page: "For the next 6 hours, today's reading is the better guide." (or "Copernicus
 * alone is closer"), up to the last lead that loses. Null when no lead loses, or when every lead loses to "assuming no
 * change" (`skillSentence` says that). It says "today's reading" when any losing lead loses to persistence.
 */
export function shortLeadNote(rows: SkillRow[]): string | null {
  const last = rows.findLastIndex((r) => !beatsBoth(r));
  if (last < 0 || rows.every(losesToNoChange)) return null;
  const better = rows.some((r) => !beatsBoth(r) && losesToNoChange(r)) ? "today's reading is the better guide" : "Copernicus alone is closer";
  return `For the next ${rows[last].lead} hours, ${better}.`;
}

/**
 * Where this forecast starts to beat both Copernicus and "assuming no change", in plain words, or null without rows (or when
 * even the longest lead loses; `shortLeadNote` has the loss). The "from" lead is the first one after the last lead that loses,
 * so the claim holds at every longer lead.
 */
export function skillSentence(rows: SkillRow[]): string | null {
  if (!rows.length) return null;
  const last = rows.findLastIndex((r) => !beatsBoth(r));
  if (last < 0) return "This forecast beats Copernicus and assuming no change at every lead time.";
  if (rows.every(losesToNoChange)) return "Assuming no change is the better guide at every lead time tested so far.";
  return last === rows.length - 1 ? null : `From ${rows[last + 1].lead} hours ahead, this forecast beats both Copernicus and assuming no change.`;
}
