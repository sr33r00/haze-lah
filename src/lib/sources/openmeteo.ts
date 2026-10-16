import type { HourPoint, SmokeGrid, Station, WeatherHour } from "../types";
import { SG, getJson, haversineKm } from "../util";

// Open-Meteo: ECMWF weather and Copernicus CAMS air-quality forecasts (CC BY 4.0).

type AQ = { hourly: { time: string[]; pm2_5: (number | null)[] } };
type GridWind = { hourly: { time: string[]; wind_speed_850hPa: (number | null)[]; wind_direction_850hPa: (number | null)[] } };
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

const GRID = { lat: [-6, 7], lon: [95, 120], step: 1 };

/** 850 hPa wind for many points. Open-Meteo sometimes answers a large request with 503 "overloaded", so it is tried twice. */
async function fetchGridWind(where: string): Promise<GridWind[]> {
  const url = `https://api.open-meteo.com/v1/forecast?${where}&hourly=wind_speed_850hPa,wind_direction_850hPa&wind_speed_unit=ms&timezone=GMT&forecast_days=4`;
  try {
    return await getJson<GridWind[]>(url, { revalidate: 10800 });
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return getJson<GridWind[]>(url, { revalidate: 10800 });
  }
}

/** Regional CAMS PM2.5 forecast on a 1° grid, sampled every 3 h for the next 72 h. */
export async function fetchSmokeGrid(): Promise<SmokeGrid> {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let la = GRID.lat[0]; la <= GRID.lat[1]; la += GRID.step) lats.push(la);
  for (let lo = GRID.lon[0]; lo <= GRID.lon[1]; lo += GRID.step) lons.push(lo);
  const pts = lats.flatMap((la) => lons.map((lo) => [la, lo]));
  const where = `latitude=${pts.map((p) => p[0]).join(",")}&longitude=${pts.map((p) => p[1]).join(",")}`;
  // The air-quality API has no wind, so the same points are asked of the weather API (same level as the wind dial).
  const [j, w] = await Promise.all([
    getJson<AQ[]>(`https://air-quality-api.open-meteo.com/v1/air-quality?${where}&hourly=pm2_5&domains=cams_global&timezone=GMT&forecast_days=4`, {
      revalidate: 10800,
    }),
    fetchGridWind(where).catch(() => null), // smoke is still useful without wind
  ]);
  const times0 = j[0].hourly.time;
  const now = Date.now() - 3600_000;
  const idx = times0
    .map((t, i) => ({ t: Date.parse(z(t)), i }))
    .filter(({ t }) => t >= now && new Date(t).getUTCHours() % 3 === 0)
    .slice(0, 25);
  const wIdx = new Map(w?.[0].hourly.time.map((t, i) => [Date.parse(z(t)), i]));
  // Wind comes "from" a direction; u and v point where it blows to.
  const comp = (t: number, f: (s: number, rad: number) => number) =>
    j.map((_, k) => {
      const h = w?.[k]?.hourly;
      // An older cached copy may not reach the last frames: hold its last hour rather than show calm air.
      const i = wIdx.get(t) ?? (h ? h.time.length - 1 : undefined);
      const s = h && i != null ? h.wind_speed_850hPa[i] : null;
      const d = h && i != null ? h.wind_direction_850hPa[i] : null;
      return s == null || d == null ? 0 : Math.round(f(s, (d * Math.PI) / 180) * 10) / 10;
    });
  return {
    lats,
    lons,
    times: idx.map(({ t }) => new Date(t).toISOString()),
    values: idx.map(({ i }) => j.map((loc) => Math.round(loc.hourly.pm2_5[i] ?? 0))),
    // No wind rather than zero wind, so a failed request never looks like calm air.
    wind: w
      ? { u: idx.map(({ t }) => comp(t, (s, r) => -s * Math.sin(r))), v: idx.map(({ t }) => comp(t, (s, r) => -s * Math.cos(r))) }
      : null,
  };
}
