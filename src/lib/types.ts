import type { Region } from "./bands";
import type { PollutantId } from "./pollutants";

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

/** A third-party webcam listed by Windy; `image` must be used as given and link to `page`. */
export type Webcam = { id: string; title: string; lat: number; lon: number; image: string; width: number; height: number; page: string; time: string };

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
  gust: number | null; // km/h, strongest gust at 10 m in that hour
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
  rainMm: number | null; // the day's total rain
  gustMax: number | null; // km/h, strongest gust of the day
};

/**
 * CAMS PM2.5 on a 1° grid over the region, every 3 hours, with the 850 hPa wind on the same grid.
 * Index is [time][lat*lons+lon]; wind is in m/s, u towards the east and v towards the north.
 * `values` is PM2.5; `gases` holds the other CAMS pollutants in the same shape, all µg/m³ and whole numbers. A cell the model
 * did not give is 0 (as in `values`), never null or NaN, and a gas with no data anywhere has no key.
 */
export type SmokeGrid = {
  lats: number[];
  lons: number[];
  times: string[];
  /** PM2.5 per time step; empty when the model gave none at all (an outage), which must not read as clean air. */
  values: number[][];
  gases: Partial<Record<Exclude<PollutantId, "pm25">, number[][]>>;
  wind: { u: number[][]; v: number[][] } | null; // null when the wind request failed
};

/** How the air reaching Singapore travelled, from the back-trail. */
export type Journey = {
  hours: number; // time the trail covers; under 72 when the path left the wind grid
  km: number; // path length, rounded to 10 km
  start: string | null; // area nearest the trail's oldest point; null when no known area is near
  left: string; // ISO; when the air was at that oldest point
};

/** Smoke from today's strongest fires, carried by the wind forecast. Only for the newest replay day. */
export type Ahead = {
  fires: number; // how many of the `checked` fires send smoke within 75 km of Singapore within 72 h
  checked: number; // the strongest fires of the last 24 h in Sumatra and Borneo
  area: string | null; // province or state with most of the fires that reach
  hours: number | null; // median hours to reach among those fires; null when none reach
  at: string | null; // ISO; now + hours
  path: [number, number][]; // forward trail from the fire: of the reaching fire closest to the median (ends near Singapore), or, when none reach, of the strongest fire (72 h)
};

/** One day of the past-week replay; the last day is today, up to the latest 3-hour step. */
export type ReplayDay = {
  date: string; // YYYY-MM-DD, SGT
  arrival: string; // ISO; when the traced air reached Singapore
  trail: [number, number][]; // where that air was, hourly going back up to 72 h, Singapore first
  from: string | null; // compass point the air came from, e.g. "southeast"
  near: number; // fires within reach of the trail while the air passed
  area: string | null; // province or state with most of those fires
  journey: Journey | null; // null when the winds were light and the air stayed near Singapore
  ahead: Ahead | null; // newest day only; null when there is no fire or wind data to work from
  fires: [number, number][]; // that UTC day's strongest fires, for the map
  total: number; // all fires that UTC day in Sumatra and Borneo
  wind: { u: number[]; v: number[] }; // on the smoke grid, at `arrival`
};

/** One 3-hour step of the wind outlook: the air arriving at Singapore at `t`. */
export type OutlookStep = {
  t: string; // ISO; when the air arrives
  from: string | null; // compass point the air came from over the last 72 h; null when it stayed near Singapore
  deg: number; // direction the wind at Singapore blows from, degrees, rounded
  kmh: number; // wind speed at Singapore, rounded
  near: number; // fires of the last 24 h within reach of that air's trail
  area: string | null; // province or state with most of them
};

export type Replay = { lats: number[]; lons: number[]; days: ReplayDay[]; outlook: OutlookStep[] };

export type HazeData = {
  generatedAt: string;
  mock: boolean;
  nea: NeaNow | null;
  history: NeaPm25History | null;
  stations: Station[];
  sensors: Sensor[];
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
