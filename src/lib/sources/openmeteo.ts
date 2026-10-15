import type { HourPoint, Station, WeatherHour } from "../types";
import { SG, getJson, haversineKm } from "../util";

// Open-Meteo: ECMWF weather and Copernicus CAMS air-quality forecasts (CC BY 4.0).

type AQ = { hourly: { time: string[]; pm2_5: (number | null)[] } };
type WX = {
  hourly: {
    time: string[];
    wind_direction_850hPa: (number | null)[];
    wind_speed_850hPa: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
  };
};

// Open-Meteo returns local times without offset when timezone is set; we ask for GMT and add Z.
const z = (t: string) => (t.endsWith("Z") ? t : `${t}Z`);

export async function fetchCamsSingapore(): Promise<HourPoint[]> {
  const j = await getJson<AQ>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SG.lat}&longitude=${SG.lon}&hourly=pm2_5&domains=cams_global&timezone=GMT&past_days=2&forecast_days=5`,
    { revalidate: 1800 },
  );
  return j.hourly.time
    .map((t, i) => ({ time: new Date(z(t)).toISOString(), value: j.hourly.pm2_5[i] }))
    .filter((p): p is HourPoint => p.value != null);
}

export async function fetchWeather(): Promise<WeatherHour[]> {
  const j = await getJson<WX>(
    `https://api.open-meteo.com/v1/forecast?latitude=${SG.lat}&longitude=${SG.lon}&hourly=wind_direction_850hPa,wind_speed_850hPa,precipitation_probability,precipitation&timezone=GMT&past_days=1&forecast_days=5`,
    { revalidate: 1800 },
  );
  const h = j.hourly;
  return h.time.map((t, i) => ({
    time: new Date(z(t)).toISOString(),
    windDir: h.wind_direction_850hPa[i] ?? NaN,
    windSpeed: h.wind_speed_850hPa[i] ?? NaN,
    rainProb: h.precipitation_probability[i],
    rain: h.precipitation[i],
  }));
}

// Upwind Indonesian cities near the main peatland fire areas. No open real-time
// station feed is available for these, so we show the CAMS model estimate.
export const UPWIND = [
  { id: "pekanbaru", name: "Pekanbaru", state: "Riau", lat: 0.5071, lon: 101.4478 },
  { id: "jambi", name: "Jambi", state: "Jambi", lat: -1.61, lon: 103.61 },
  { id: "palembang", name: "Palembang", state: "South Sumatra", lat: -2.9761, lon: 104.7754 },
  { id: "pontianak", name: "Pontianak", state: "West Kalimantan", lat: -0.0263, lon: 109.3425 },
  { id: "palangkaraya", name: "Palangka Raya", state: "Central Kalimantan", lat: -2.2161, lon: 113.914 },
];

export async function fetchUpwindModel(): Promise<Station[]> {
  const lats = UPWIND.map((c) => c.lat).join(",");
  const lons = UPWIND.map((c) => c.lon).join(",");
  const j = await getJson<AQ[] | AQ>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm2_5&domains=cams_global&timezone=GMT&past_days=0&forecast_days=1`,
    { revalidate: 1800 },
  );
  const arr = Array.isArray(j) ? j : [j];
  const nowIdx = (times: string[]) => {
    const now = Date.now();
    let best = 0;
    times.forEach((t, i) => {
      if (Date.parse(z(t)) <= now) best = i;
    });
    return best;
  };
  return UPWIND.map((c, k) => {
    const h = arr[k]?.hourly;
    const i = h ? nowIdx(h.time) : 0;
    const v = h?.pm2_5[i];
    return {
      ...c,
      country: "ID" as const,
      api: null,
      pm25: v != null ? Math.round(v) : null,
      time: h ? new Date(z(h.time[i])).toISOString() : null,
      distanceKm: Math.round(haversineKm(SG.lat, SG.lon, c.lat, c.lon)),
    };
  });
}
