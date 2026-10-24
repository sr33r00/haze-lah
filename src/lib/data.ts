import { unstable_cache } from "next/cache";
import { FORECAST_METHOD, buildForecast, dailyOutlook } from "./forecast";
import { mockInputs } from "./mock";
import { fetchApims } from "./sources/apims";
import { fetchFires } from "./sources/firms";
import { fetchNews } from "./sources/news";
import { fetchNeaNow, fetchNeaPm25History, fetchPsiDaily } from "./sources/nea";
import { fetchCamsSingapore, fetchUpwindModel, fetchWeather } from "./sources/openmeteo";
import { fetchCommunitySensors } from "./sources/openaq";
import { fetchAqiStations } from "./sources/waqi";
import type { AqiStation, DayPsi, FireSummary, HazeData, HourPoint, NeaNow, NewsItem, NeaPm25History, Sensor, Station, WeatherHour } from "./types";

/** Raw inputs from every source; any of them may be missing. */
export type Inputs = {
  nea: NeaNow | null;
  history: NeaPm25History | null;
  cams: HourPoint[];
  weather: WeatherHour[];
  stations: Station[];
  sensors: Sensor[];
  aqiStations: AqiStation[];
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
  const [now, hist, apims, upwind, fires, cams, weather, news, psiDaily, sensors, aqiStations] = await Promise.allSettled([
    fetchNeaNow(),
    fetchNeaPm25History(),
    fetchApims(),
    fetchUpwindModel(),
    fetchFires(),
    fetchCamsSingapore(),
    fetchWeather(),
    fetchNews(),
    fetchPsiDaily(),
    fetchCommunitySensors(),
    fetchAqiStations(),
  ]);
  return {
    nea: settled(now, "NEA PSI", errors),
    history: settled(hist, "NEA PM2.5", errors),
    cams: settled(cams, "CAMS forecast", errors) ?? [],
    weather: settled(weather, "Weather", errors) ?? [],
    stations: [...(settled(apims, "Malaysia APIMS", errors) ?? []), ...(settled(upwind, "Upwind model", errors) ?? [])],
    sensors: settled(sensors, "Community sensors", errors) ?? [],
    aqiStations: settled(aqiStations, "AQI stations", errors) ?? [],
    fires: settled(fires, "NASA FIRMS", errors) ?? NO_FIRES,
    news: settled(news, "News", errors) ?? [],
    psiDaily: settled(psiDaily, "NEA PSI history", errors) ?? [],
    errors,
  };
}

async function buildHazeData(mock: boolean): Promise<HazeData> {
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
      sigma: fc ? Math.round(fc.sigma * 100) / 100 : null,
      hourly: fc?.points ?? [],
      days: fc && inp.history ? dailyOutlook(inp.history.island, fc.points, inp.weather) : [],
    },
  };
}

// Build machines sometimes lose a source (timeouts, 429s) that the live server in sin1 gets fine, so a deploy's prerender
// keeps its data 5 minutes: Next.js gives the pages that revalidate, and their first refresh runs on the live server.
const BUILDING = process.env.NEXT_PHASE === "phase-production-build";

/** Pages and the API share one build, kept for 30 minutes (5 at build) so a page render costs no source calls or forecast work. */
const cachedHazeData = unstable_cache(
  async () => {
    const data = await buildHazeData(false);
    // Without NEA or the forecast there is nothing worth keeping for 30 minutes: throwing stops the cache storing it.
    if (!data.nea || !data.history || !data.forecast.available) throw new Error("NEA data or forecast missing");
    return data;
  },
  [BUILDING ? "haze-data-build" : "haze-data"],
  { revalidate: BUILDING ? 300 : 1800 },
);

// A partial build is kept 1 minute, so the pages built from it (their revalidate drops to match) retry the sources soon.
const partialHazeData = unstable_cache(() => buildHazeData(false), ["haze-data-partial"], { revalidate: 60 });

/** All the data behind the pages; `generatedAt` is when it was built. Mock mode (HAZE_MOCK=1) is never cached. */
export async function getHazeData(): Promise<HazeData> {
  if (process.env.HAZE_MOCK === "1") return buildHazeData(true);
  // When NEA or the forecast is missing, serve the partial build and try the full one again within a minute.
  return cachedHazeData().catch(() => partialHazeData());
}
