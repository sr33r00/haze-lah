import { unstable_cache } from "next/cache";
import { FORECAST_METHOD, buildForecast, dailyOutlook, fromHour } from "./forecast";
import { mockInputs } from "./mock";
import { fetchApims } from "./sources/apims";
import { fetchFires } from "./sources/firms";
import { fetchNews } from "./sources/news";
import { fetchNeaNow, fetchNeaPm25History, fetchPsiDaily } from "./sources/nea";
import { fetchCamsSingapore, fetchUpwindModel, fetchWeather } from "./sources/openmeteo";
import { fetchCommunitySensors } from "./sources/openaq";
import { fetchAqiStations } from "./sources/waqi";
import type { AqiStation, DayPsi, FireSummary, HazeData, HourPoint, NeaNow, NewsItem, NeaPm25History, SavedForecast, Sensor, Station, WeatherHour } from "./types";

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

const FORECAST_URL =
  process.env.FORECAST_URL || "https://raw.githubusercontent.com/sr33r00/haze-lah/main/data/forecast-latest.json";

/** The last live forecast saved in the repo, without the hours already past; null when it is missing or has run out. */
async function fetchSavedForecast(): Promise<SavedForecast | null> {
  try {
    const res = await fetch(FORECAST_URL, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const saved = (await res.json()) as SavedForecast;
    const hourly = fromHour(saved.hourly);
    return hourly.length ? { ...saved, hourly } : null;
  } catch {
    return null;
  }
}

async function buildHazeData(mock: boolean): Promise<HazeData> {
  const { cams, ...inp } = mock ? mockInputs() : await fetchInputs();
  const fc = inp.history ? buildForecast(inp.history.island, cams) : null;
  if (!fc && inp.history) inp.errors.push("Forecast");
  const saved = !fc && !mock && inp.history ? await fetchSavedForecast() : null;
  const points = fc?.points ?? saved?.hourly ?? [];
  return {
    ...inp,
    generatedAt: new Date().toISOString(),
    mock,
    forecast: {
      available: points.length > 0,
      method: FORECAST_METHOD,
      biasFactor: fc ? Math.round(fc.bias * 100) / 100 : (saved?.biasFactor ?? null),
      sigma: fc ? Math.round(fc.sigma * 100) / 100 : (saved?.sigma ?? null),
      hourly: points,
      days: inp.history && points.length ? dailyOutlook(inp.history.island, points, inp.weather) : [],
      savedFrom: saved?.issued ?? null,
    },
  };
}

// Build machines sometimes lose a source (timeouts, 429s) that the live server in sin1 gets fine, so a deploy's prerender
// keeps its data 5 minutes: Next.js gives the pages that revalidate, and their first refresh runs on the live server.
const BUILDING = process.env.NEXT_PHASE === "phase-production-build";

/** Cache tag on the shared data build; `/api/refresh` revalidates it when NEA publishes a new hour. */
export const HAZE_DATA_TAG = "haze-data";

/** NEA publishes PM2.5 hourly; 3 hours allows for one late hour. An older newest reading means a source failed. */
const MAX_READING_AGE_MS = 3 * 3600_000;

/** Pages and the API share one build, kept for 30 minutes (5 at build), or until `/api/refresh` sees a newer NEA hour, so a page render costs no source calls or forecast work. */
const cachedHazeData = unstable_cache(
  async () => {
    const data = await buildHazeData(false);
    // Without NEA, the live forecast (a saved one does not count) or a fresh PM2.5 reading (today's request failed, so the forecast starts in the past)
    // there is nothing worth keeping for 30 minutes: throwing stops the cache storing it.
    const newest = data.history?.island.at(-1);
    if (!data.nea || !newest || !data.forecast.available || data.forecast.savedFrom || Date.now() - Date.parse(newest.time) > MAX_READING_AGE_MS) {
      throw new Error("NEA data or forecast missing or stale");
    }
    return data;
  },
  [BUILDING ? "haze-data-build" : "haze-data"],
  { revalidate: BUILDING ? 300 : 1800, tags: [HAZE_DATA_TAG] },
);

// A partial build is kept 1 minute, so the pages built from it (their revalidate drops to match) retry the sources soon.
const partialHazeData = unstable_cache(() => buildHazeData(false), ["haze-data-partial"], { revalidate: 60, tags: [HAZE_DATA_TAG] });

/** All the data behind the pages; `generatedAt` is when it was built. Mock mode (HAZE_MOCK=1) is never cached. */
export async function getHazeData(): Promise<HazeData> {
  if (process.env.HAZE_MOCK === "1") return buildHazeData(true);
  // When NEA or the live forecast is missing, serve the partial build and try the full one again within a minute.
  // Outside Next.js (the scripts) unstable_cache throws, so build directly.
  return cachedHazeData().catch(() => partialHazeData().catch(() => buildHazeData(false)));
}
