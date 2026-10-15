// Synthetic data for local development and screenshots (HAZE_MOCK=1). Not real readings.
import { REGIONS, type Region } from "./bands";
import { FORECAST_METHOD, buildForecast, dailyOutlook } from "./forecast";
import type { HazeData, HourPoint, Station, WeatherHour } from "./types";
import { hourKey } from "./util";

export function mockData(): HazeData {
  const now = Date.parse(hourKey(new Date()));
  const H = 3600_000;
  const shape = (t: number) => {
    const sgHour = (new Date(t).getUTCHours() + 8) % 24;
    return 1 + 0.35 * Math.cos(((sgHour - 7) / 24) * 2 * Math.PI);
  };
  const regionScale: Record<Region, number> = { north: 0.7, south: 0.9, east: 0.95, west: 1.25, central: 1.05 };
  const regions = Object.fromEntries(REGIONS.map((r) => [r, [] as HourPoint[]])) as Record<Region, HourPoint[]>;
  const island: HourPoint[] = [];
  for (let h = 40; h >= 0; h--) {
    const t = now - h * H;
    const base = 95 * shape(t) * (1 + 0.15 * Math.sin(h / 5));
    let sum = 0;
    for (const r of REGIONS) {
      const v = Math.round(base * regionScale[r]);
      regions[r].push({ time: new Date(t).toISOString(), value: v });
      sum += v;
    }
    island.push({ time: new Date(t).toISOString(), value: sum / REGIONS.length });
  }
  const cams: HourPoint[] = [];
  for (let h = -48; h <= 120; h++) {
    const t = now + h * H;
    const trend = h > 30 ? Math.max(0.35, 1 - (h - 30) / 80) : 1;
    cams.push({ time: new Date(t).toISOString(), value: 38 * shape(t) * trend });
  }
  const weather: WeatherHour[] = [];
  for (let h = -24; h <= 120; h++) {
    weather.push({
      time: new Date(now + h * H).toISOString(),
      windDir: h < 50 ? 225 : 160,
      windSpeed: 18,
      rainProb: h > 60 ? 70 : 20,
      rain: h > 60 ? 2 : 0,
    });
  }
  const fc = buildForecast(island, cams)!;
  const st = (id: string, name: string, state: string, lat: number, lon: number, api: number, pm25: number, d: number): Station => ({
    id, name, state, country: "MY", lat, lon, api, pm25, time: new Date(now).toISOString(), distanceKm: d,
  });
  return {
    generatedAt: new Date().toISOString(),
    mock: true,
    nea: {
      time: new Date(now).toISOString(),
      psi24: { north: 126, south: 159, east: 173, west: 197, central: 183 },
      pm25_24h: { north: 80, south: 111, east: 124, west: 148, central: 134 },
      pm10_24h: { north: 99, south: 144, east: 171, west: 168, central: 165 },
    },
    history: { regions, island },
    stations: [
      st("CA25J", "Pasir Gudang", "Johor", 1.47, 103.89, 168, 92, 14),
      st("CA27J", "Johor Bahru", "Johor", 1.5, 103.75, 172, 101, 18),
      st("CA31J", "Batu Pahat", "Johor", 1.86, 102.93, 177, 128, 113),
      st("CA32J", "Kluang", "Johor", 2.03, 103.32, 166, 133, 93),
      st("CA29J", "Segamat", "Johor", 2.5, 102.8, 161, 78, 170),
      st("CA35M", "Bandaraya Melaka", "Melaka", 2.21, 102.25, 158, 84, 198),
      { id: "pekanbaru", name: "Pekanbaru", state: "Riau", country: "ID", lat: 0.51, lon: 101.45, api: null, pm25: 210, time: null, distanceKm: 279 },
      { id: "jambi", name: "Jambi", state: "Jambi", country: "ID", lat: -1.61, lon: 103.61, api: null, pm25: 165, time: null, distanceKm: 330 },
      { id: "palembang", name: "Palembang", state: "South Sumatra", country: "ID", lat: -2.98, lon: 104.78, api: null, pm25: 240, time: null, distanceKm: 492 },
      { id: "pontianak", name: "Pontianak", state: "West Kalimantan", country: "ID", lat: -0.03, lon: 109.34, api: null, pm25: 60, time: null, distanceKm: 632 },
    ],
    fires: {
      available: true,
      days: 2,
      sumatra: 1243,
      borneo: 318,
      peninsula: 12,
      points: Array.from({ length: 300 }, (_, i) => {
        const sum = i < 230;
        return {
          lat: sum ? -3.2 + Math.sin(i * 1.7) * 2.2 : -1.5 + Math.sin(i) * 1.6,
          lon: sum ? 103.2 + Math.cos(i * 2.3) * 2.0 : 112 + Math.cos(i * 1.3) * 2.5,
          frp: 5 + ((i * 37) % 60),
          time: new Date(now).toISOString(),
          confidence: "n",
        };
      }),
    },
    weather,
    forecast: {
      available: true,
      method: FORECAST_METHOD,
      biasFactor: Math.round(fc.bias * 100) / 100,
      hourly: fc.points,
      days: dailyOutlook(island, fc.points, weather),
    },
    errors: [],
  };
}
