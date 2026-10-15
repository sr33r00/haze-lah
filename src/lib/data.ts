import { FORECAST_METHOD, buildForecast, dailyOutlook } from "./forecast";
import { mockInputs } from "./mock";
import { fetchApims } from "./sources/apims";
import { fetchFires } from "./sources/firms";
import { fetchNews } from "./sources/news";
import { fetchNeaNow, fetchNeaPm25History, fetchPsiDaily } from "./sources/nea";
import { fetchCamsSingapore, fetchUpwindModel, fetchWeather } from "./sources/openmeteo";
import type { DayPsi, FireSummary, HazeData, HourPoint, NeaNow, NewsItem, NeaPm25History, Station, WeatherHour } from "./types";

/** Raw inputs from every source; any of them may be missing. */
export type Inputs = {
  nea: NeaNow | null;
  history: NeaPm25History | null;
  cams: HourPoint[];
  weather: WeatherHour[];
  stations: Station[];
  fires: FireSummary;
  news: NewsItem[];
  psiDaily: DayPsi[];
  errors: string[];
};

const NO_FIRES: FireSummary = { available: false, days: 2, sumatra: 0, borneo: 0, peninsula: 0, points: [], daily: [] };

function settled<T>(r: PromiseSettledResult<T>, label: string, errors: string[]): T | null {
  if (r.status === "fulfilled") return r.value;
  // Details stay in server logs; the public payload only names the source.
  console.error(`[haze] ${label}:`, r.reason);
  errors.push(label);
  return null;
}

async function fetchInputs(): Promise<Inputs> {
  const errors: string[] = [];
  const [now, hist, apims, upwind, fires, cams, weather, news, psiDaily] = await Promise.allSettled([
    fetchNeaNow(),
    fetchNeaPm25History(),
    fetchApims(),
    fetchUpwindModel(),
    fetchFires(),
    fetchCamsSingapore(),
    fetchWeather(),
    fetchNews(),
    fetchPsiDaily(),
  ]);
  return {
    nea: settled(now, "NEA PSI", errors),
    history: settled(hist, "NEA PM2.5", errors),
    cams: settled(cams, "CAMS forecast", errors) ?? [],
    weather: settled(weather, "Weather", errors) ?? [],
    stations: [...(settled(apims, "Malaysia APIMS", errors) ?? []), ...(settled(upwind, "Upwind model", errors) ?? [])],
    fires: settled(fires, "NASA FIRMS", errors) ?? NO_FIRES,
    news: settled(news, "News", errors) ?? [],
    psiDaily: settled(psiDaily, "NEA PSI history", errors) ?? [],
    errors,
  };
}

export async function getHazeData(): Promise<HazeData> {
  const mock = process.env.HAZE_MOCK === "1";
  const { cams, ...inp } = mock ? mockInputs() : await fetchInputs();
  const fc = inp.history ? buildForecast(inp.history.island, cams) : null;
  if (!fc && inp.history) inp.errors.push("Forecast");
  return {
    ...inp,
    generatedAt: new Date().toISOString(),
    mock,
    forecast: {
      available: !!fc,
      method: FORECAST_METHOD,
      biasFactor: fc ? Math.round(fc.bias * 100) / 100 : null,
      hourly: fc?.points ?? [],
      days: fc && inp.history ? dailyOutlook(inp.history.island, fc.points, inp.weather) : [],
    },
  };
}
