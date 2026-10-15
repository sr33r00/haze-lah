import { pm25ToPsi } from "./bands";
import type { DayOutlook, ForecastPoint, HourPoint, WeatherHour } from "./types";
import { hourKey, median, sgDate } from "./util";

export const FORECAST_METHOD =
  "Copernicus CAMS PM2.5 forecast, calibrated against NEA's live readings from the past 48 hours: a multiplicative bias correction, plus the current error fading out over about 12 hours. The shaded band is the typical recent error, widening with lead time.";

/**
 * Statistical post-processing of the CAMS model forecast (model output statistics).
 * CAMS gets the timing of smoke episodes broadly right but is often far off in
 * magnitude for peat haze, so we rescale it to what NEA's monitors actually measure.
 */
export function buildForecast(obs: HourPoint[], cams: HourPoint[], hours = 120) {
  const camsBy = new Map(cams.map((p) => [hourKey(p.time), Math.max(p.value, 3)]));
  const pairs = obs
    .map((o) => ({ o: o.value, c: camsBy.get(hourKey(o.time)) }))
    .filter((p): p is { o: number; c: number } => p.c != null && p.o > 0)
    .slice(-48);
  if (pairs.length < 6) return null;

  const logRatios = pairs.map((p) => Math.log(p.o / p.c));
  const recent = logRatios.slice(-24);
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
    const s = sigma * Math.sqrt(1 + h / 24);
    points.push({
      time: t,
      pm25: Math.round(est),
      low: Math.round(est * Math.exp(-s)),
      high: Math.round(est * Math.exp(s)),
      raw: Math.round(c),
    });
  }
  return { bias, sigma, points };
}

/** Daily outlook: expected peak 24-hr PSI (from a rolling 24-h PM2.5 mean) per SGT day. */
export function dailyOutlook(obs: HourPoint[], fc: ForecastPoint[], weather: WeatherHour[], days = 5): DayOutlook[] {
  const series = [
    ...obs.map((p) => ({ t: Date.parse(p.time), v: p.value, future: false })),
    ...fc.map((p) => ({ t: Date.parse(p.time), v: p.pm25, future: true })),
  ].sort((a, b) => a.t - b.t);
  const rain = new Map<string, number>();
  for (const w of weather) {
    if (w.rainProb == null) continue;
    const d = sgDate(0, new Date(w.time));
    rain.set(d, Math.max(rain.get(d) ?? 0, w.rainProb));
  }
  const out: DayOutlook[] = [];
  for (let k = 0; k < days; k++) {
    const date = sgDate(k);
    let psiMax = 0;
    let pmMax = 0;
    let any = false;
    for (let i = 0; i < series.length; i++) {
      const p = series[i];
      if (sgDate(0, new Date(p.t)) !== date) continue;
      const win = series.filter((q) => q.t > p.t - 24 * 3600_000 && q.t <= p.t);
      if (win.length < 18) continue;
      any = true;
      const mean = win.reduce((a, q) => a + q.v, 0) / win.length;
      psiMax = Math.max(psiMax, pm25ToPsi(mean));
      pmMax = Math.max(pmMax, p.v);
    }
    if (any) out.push({ date, psiMax, pm25Max: Math.round(pmMax), rainProb: rain.get(date) ?? null });
  }
  return out;
}
