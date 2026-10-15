import type { Region } from "./bands";

export type RegionValues = Record<Region, number>;

export type NeaNow = {
  time: string; // ISO, SGT
  psi24: RegionValues;
  pm25_24h: RegionValues;
  pm10_24h: RegionValues;
};

export type HourPoint = { time: string; value: number };

export type NeaPm25History = {
  regions: Record<Region, HourPoint[]>; // 1-hr PM2.5, oldest first
  island: HourPoint[]; // mean across regions
};

export type Station = {
  id: string;
  name: string;
  state: string;
  country: "MY" | "SG" | "ID";
  lat: number;
  lon: number;
  api: number | null; // Malaysia API (same band edges as PSI)
  pm25: number | null; // latest hourly µg/m³
  time: string | null;
  distanceKm: number;
};

export type Fire = { lat: number; lon: number; frp: number; time: string; confidence: string };

export type FireSummary = {
  available: boolean;
  reason?: string;
  days: number;
  sumatra: number;
  borneo: number;
  peninsula: number;
  points: Fire[]; // capped for the map
};

export type WeatherHour = {
  time: string;
  windDir: number; // degrees, meteorological (from)
  windSpeed: number; // km/h at 850 hPa
  rainProb: number | null;
  rain: number | null; // mm
};

export type ForecastPoint = {
  time: string;
  pm25: number; // corrected 1-hr estimate
  low: number;
  high: number;
  raw: number; // CAMS model value
};

export type DayOutlook = {
  date: string; // YYYY-MM-DD
  psiMax: number; // expected peak 24-hr PSI
  pm25Max: number; // expected peak 1-hr PM2.5
  rainProb: number | null;
};

export type HazeData = {
  generatedAt: string;
  mock: boolean;
  nea: NeaNow | null;
  history: NeaPm25History | null;
  stations: Station[];
  fires: FireSummary;
  weather: WeatherHour[];
  forecast: {
    available: boolean;
    method: string;
    biasFactor: number | null;
    hourly: ForecastPoint[];
    days: DayOutlook[];
  };
  errors: string[];
};
