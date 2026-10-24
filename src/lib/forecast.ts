import { pm25ToPsi } from "./bands";
import type { DayOutlook, ForecastPoint, HourPoint, WeatherHour } from "./types";
import { hourKey, median, sgDate, sgHour } from "./util";

export const FORECAST_METHOD =
  "Copernicus CAMS global PM2.5 forecast (0.4° grid, about 45 km, 3-hourly, interpolated to hourly), calibrated against NEA's live readings from the past 48 hours: a multiplicative bias correction, plus the current error fading out over about 12 hours. The likely range is the typical recent error, widening with lead time.";

export const HIGH_PM25 = 55; // top of NEA 1-hr PM2.5 Band I (Normal)

/** The forecast from the current hour: hours that ended more than an hour before `now` are dropped. The hero and Plan your day both start here. */
export function fromHour<T extends { time: string }>(hourly: T[], now = Date.now()): T[] {
  return hourly.filter((p) => Date.parse(p.time) >= now - 3600_000);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
function phi(x: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Statistical post-processing of the CAMS model forecast (model output statistics).
 * CAMS gets the timing of smoke episodes broadly right but is often far off in
 * magnitude for peat haze, so we rescale it to what NEA's monitors actually measure.
 * Errors are treated as log-normal, which gives the likely range and exceedance chance.
 */
export function buildForecast(obs: HourPoint[], cams: HourPoint[], hours = 120) {
  const camsBy = new Map(cams.map((p) => [hourKey(p.time), Math.max(p.value, 3)]));
  const pairs = obs
    .map((o) => ({ o: o.value, c: camsBy.get(hourKey(o.time)) }))
    .filter((p): p is { o: number; c: number } => p.c != null && p.o > 0)
    .slice(-48);
  if (pairs.length < 6) return null;

  const recent = pairs.map((p) => Math.log(p.o / p.c)).slice(-24);
  const bias = Math.exp(Math.min(Math.max(median(recent), Math.log(0.3)), Math.log(6)));
  const resid = recent.map((r) => r - Math.log(bias));
  const sigma = Math.max(0.2, Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / resid.length));

  const last = obs[obs.length - 1];
  const lastC = camsBy.get(hourKey(last.time));
  const anomaly = lastC ? Math.min(Math.max(last.value / (lastC * bias), 0.25), 4) : 1;

  const start = Date.parse(hourKey(last.time));
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= hours; h++) {
    const t = new Date(start + h * 3600_000).toISOString();
    const c = camsBy.get(t);
    if (c == null) continue;
    const est = c * bias * Math.pow(anomaly, Math.exp(-h / 12));
    // Persistence is very good in the first hours, so the range starts narrow.
    const s = sigma * Math.min(1, 0.35 + h / 12) * Math.sqrt(1 + h / 48);
    points.push({
      time: t,
      pm25: Math.round(est),
      low: Math.round(est * Math.exp(-s)),
      high: Math.round(est * Math.exp(s)),
      raw: Math.round(c),
      pHigh: Math.round(100 * (1 - phi((Math.log(HIGH_PM25) - Math.log(est)) / s))) / 100,
    });
  }
  return { bias, sigma, points };
}

/** Daily outlook per SGT day: peak 24-hr PSI (rolling 24-h PM2.5 mean), peak range, chance of high PM2.5, parts of day. */
export function dailyOutlook(obs: HourPoint[], fc: ForecastPoint[], weather: WeatherHour[], days = 5): DayOutlook[] {
  type S = { t: number; v: number; lo: number; hi: number; p: number };
  const series: S[] = [
    ...obs.map((o) => ({ t: Date.parse(o.time), v: o.value, lo: o.value, hi: o.value, p: o.value > HIGH_PM25 ? 1 : 0 })),
    ...fc.map((f) => ({ t: Date.parse(f.time), v: f.pm25, lo: f.low, hi: f.high, p: f.pHigh })),
  ].sort((a, b) => a.t - b.t);
  const rain = new Map<string, number>();
  const mm = new Map<string, number>();
  const gust = new Map<string, number>();
  for (const w of weather) {
    const d = sgDate(0, new Date(w.time));
    if (w.rainProb != null) rain.set(d, Math.max(rain.get(d) ?? 0, w.rainProb));
    if (w.rain != null) mm.set(d, (mm.get(d) ?? 0) + w.rain);
    if (w.gust != null) gust.set(d, Math.max(gust.get(d) ?? 0, w.gust));
  }
  const out: DayOutlook[] = [];
  for (let k = 0; k < days; k++) {
    const date = sgDate(k);
    const day = series.filter((p) => sgDate(0, new Date(p.t)) === date);
    if (!day.length) continue;
    let psiMax = 0;
    for (const p of day) {
      const win = series.filter((q) => q.t > p.t - 24 * 3600_000 && q.t <= p.t);
      if (win.length >= 18) psiMax = Math.max(psiMax, pm25ToPsi(win.reduce((a, q) => a + q.v, 0) / win.length));
    }
    if (!psiMax) continue;
    const peak = day.reduce((a, b) => (b.v > a.v ? b : a));
    const part = (from: number, to: number) => {
      const xs = day.filter((p) => sgHour(p.t) >= from && sgHour(p.t) < to).map((p) => p.v);
      return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    };
    out.push({
      date,
      psiMax,
      pm25Max: Math.round(peak.v),
      low: Math.round(Math.max(...day.map((p) => p.lo))),
      high: Math.round(Math.max(...day.map((p) => p.hi))),
      pHigh: Math.max(...day.map((p) => p.p)),
      parts: [part(6, 12), part(12, 18), part(18, 24)],
      rainProb: rain.get(date) ?? null,
      rainMm: mm.get(date) ?? null,
      gustMax: gust.has(date) ? Math.round(gust.get(date)!) : null,
    });
  }
  return out;
}
