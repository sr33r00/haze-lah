import type { Region } from "./bands";

export type RegionValues = Record<Region, number>;

export type NeaNow = {
  time: string; // ISO, SGT
  psi24: RegionValues;
  pm25_24h: RegionValues;
  pm10_24h: RegionValues;
  /** PSI sub-indices per pollutant (the PSI is the highest of these). */
  sub: { pm25: RegionValues; pm10: RegionValues; o3: RegionValues; so2: RegionValues; co: RegionValues };
  no2_1h_max: RegionValues; // µg/m³, no PSI sub-index
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

/** Low-cost community air sensor (OpenAQ); pm25 in µg/m³. */
export type Sensor = { name: string; lat: number; lon: number; pm25: number; time: string };

/** A public traffic camera photo (LTA). */
export type Camera = { id: string; name: string; region: Region; lat: number; lon: number; image: string; time: string };

export type Fire = { lat: number; lon: number; frp: number; time: string; confidence: string };

export type FireSummary = {
  available: boolean;
  reason?: string;
  days: number;
  sumatra: number;
  borneo: number;
  peninsula: number;
  points: Fire[]; // last `days` days only, capped for the map
  daily: { date: string; sumatra: number; borneo: number }[]; // UTC acq_date, oldest first; the last day is partial
};

export type NewsItem = {
  source: "NEA" | "MSS" | "CNA" | "ST";
  title: string;
  summary: string;
  date: string; // YYYY-MM-DD or ISO
  url: string;
};

/** Highest 24-hr PSI of one SGT day, and where. */
export type DayPsi = { date: string; max: number; region: Region };

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
  pHigh: number; // probability 1-hr PM2.5 exceeds 55 µg/m³ (NEA Band I)
};

export type DayOutlook = {
  date: string; // YYYY-MM-DD, SGT
  psiMax: number; // expected peak 24-hr PSI
  pm25Max: number; // expected peak 1-hr PM2.5
  low: number; // likely range of that peak
  high: number;
  pHigh: number; // chance 1-hr PM2.5 goes above 55 at some point that day
  parts: (number | null)[]; // mean 1-hr PM2.5: morning 6-12, afternoon 12-18, evening 18-24
  rainProb: number | null;
};

/**
 * CAMS PM2.5 on a 1° grid over the region, every 3 hours, with the 850 hPa wind on the same grid.
 * Index is [time][lat*lons+lon]; wind is in m/s, u towards the east and v towards the north.
 */
export type SmokeGrid = {
  lats: number[];
  lons: number[];
  times: string[];
  values: number[][];
  wind: { u: number[][]; v: number[][] } | null; // null when the wind request failed
};

/** One day of the past-week replay; the last day is today, up to the latest 3-hour step. */
export type ReplayDay = {
  date: string; // YYYY-MM-DD, SGT
  arrival: string; // ISO; when the traced air reached Singapore
  trail: [number, number][]; // where that air was, hourly going back up to 72 h, Singapore first
  from: string | null; // compass point the air came from, e.g. "south-east"
  near: number; // fires within reach of the trail while the air passed
  area: string | null; // province or state with most of those fires
  fires: [number, number][]; // that UTC day's strongest fires, for the map
  total: number; // all fires that UTC day in Sumatra and Borneo
  wind: { u: number[]; v: number[] }; // on the smoke grid, at `arrival`
};

export type Replay = { lats: number[]; lons: number[]; days: ReplayDay[] };

export type HazeData = {
  generatedAt: string;
  mock: boolean;
  nea: NeaNow | null;
  history: NeaPm25History | null;
  stations: Station[];
  sensors: Sensor[];
  cameras: Camera[];
  fires: FireSummary;
  news: NewsItem[];
  psiDaily: DayPsi[];
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
