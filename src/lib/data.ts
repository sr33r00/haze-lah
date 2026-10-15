import { REGIONS } from "./bands";
import { FORECAST_METHOD, buildForecast, dailyOutlook } from "./forecast";
import { mockData } from "./mock";
import { fetchApims } from "./sources/apims";
import { fetchFires } from "./sources/firms";
import { fetchNeaNow, fetchNeaPm25History } from "./sources/nea";
import { fetchCamsSingapore, fetchUpwindModel, fetchWeather } from "./sources/openmeteo";
import type { FireSummary, HazeData } from "./types";

function settled<T>(r: PromiseSettledResult<T>, label: string, errors: string[]): T | null {
  if (r.status === "fulfilled") return r.value;
  errors.push(`${label}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  return null;
}

export async function getHazeData(): Promise<HazeData> {
  if (process.env.HAZE_MOCK === "1") return mockData();
  const errors: string[] = [];
  const [now, hist, apims, upwind, fires, cams, weather] = await Promise.allSettled([
    fetchNeaNow(),
    fetchNeaPm25History(),
    fetchApims(),
    fetchUpwindModel(),
    fetchFires(),
    fetchCamsSingapore(),
    fetchWeather(),
  ]);
  const nea = settled(now, "NEA PSI", errors);
  const history = settled(hist, "NEA PM2.5", errors);
  const camsPts = settled(cams, "CAMS forecast", errors) ?? [];
  const wx = settled(weather, "Weather", errors) ?? [];
  const fireSummary: FireSummary = settled(fires, "NASA FIRMS", errors) ?? {
    available: false,
    reason: "unavailable",
    days: 2,
    sumatra: 0,
    borneo: 0,
    peninsula: 0,
    points: [],
  };

  const fc = history ? buildForecast(history.island, camsPts) : null;
  if (!fc && history) errors.push("Forecast: not enough overlap between NEA and CAMS");

  return {
    generatedAt: new Date().toISOString(),
    mock: false,
    nea,
    history,
    stations: [...(settled(apims, "Malaysia APIMS", errors) ?? []), ...(settled(upwind, "Upwind model", errors) ?? [])],
    fires: fireSummary,
    weather: wx,
    forecast: {
      available: !!fc,
      method: FORECAST_METHOD,
      biasFactor: fc ? Math.round(fc.bias * 100) / 100 : null,
      hourly: fc?.points ?? [],
      days: fc && history ? dailyOutlook(history.island, fc.points, wx) : [],
    },
    errors,
  };
}

export { REGIONS };
