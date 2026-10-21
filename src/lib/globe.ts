import { SG, sgDate, sgHour } from "./util";

// The globe of NASA pollution data: carbon monoxide and smoke pictures drawn by /api/globe/[layer] from NASA GIBS,
// and each day's reading over Singapore from /api/globe/[layer]/series. Pure config, shared by the server and the browser.

export type GlobeLayer = "co" | "smoke";
type Rgb = [number, number, number];

/**
 * Colour stops from t = 0 (`range[0]`) to t = 1 (`range[1]`), what the colours mean and the words for each end.
 * With `soft`, the picture fades out below that t, so that nothing is drawn where there is none of it.
 */
type Ramp = { unit: string; range: [number, number]; ends: [string, string]; stops: [t: number, rgb: Rgb][]; soft?: number };

/** The area the flat poster shows, behind the globe, centred on Singapore: [south, west, north, east]. */
export const REGION = [SG.lat - 20, SG.lon - 30, SG.lat + 20, SG.lon + 30] as const;

/**
 * The coastlines of `REGION` for the poster, a transparent PNG (white with a soft dark edge) in Web Mercator, 1500×1021. It never
 * changes, so it ships with the site; made from NASA GIBS: https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&CRS=EPSG:3857&BBOX=8217582.546,-2113525.382,14896751.994,2433912.613&WIDTH=1500&HEIGHT=1021&FORMAT=image/png&TRANSPARENT=true&LAYERS=Coastlines_15m
 * (BBOX is REGION in metres), its alpha recoloured and blurred under itself, saved as a palette PNG.
 */
export const REGION_COAST = "/coast.png";

/** The pictures are Web Mercator squares, as MapLibre places images: the latitude the square ends at, north and south. */
export const MERC_LAT = 85.0511;

/** How far down a Web Mercator square of the world `lat` sits, from 0 (top) to 1. */
export const mercY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/** The satellites' daytime pass, local time: Aqua (AIRS) crosses the equator at 1:30 pm, and so do the NOAA-20 and NOAA-21 (OMPS). https://aqua.nasa.gov/content/about-aqua */
export const PASS_TIME = "1:30 pm";

/** How much of the map shows through the data. */
export const DATA_OPACITY = 0.75;

/** The box over Singapore, in degrees each way, whose mean is the reading of a day. */
export const READ_BOX = 1;

/** One frame per day, the last week up to the newest. */
export const FRAMES = 8;

/** How a reading is written, to `digits` decimals; a reading under `floor` is "clear". */
type Read = { prefix: string; suffix: string; digits: number; floor?: number };

/** What a layer is: its words, how many days it averages, its colours and how a reading is written. */
type Layer = { label: string; days: number; note: string; ramp: Ramp; read: Read };

export const GLOBE_LAYERS: Record<GlobeLayer, Layer> = {
  co: {
    label: "Carbon monoxide",
    days: 3,
    note: "Carbon monoxide about 5.5 km up, averaged over 3 days. It comes from burning: red is heavy.",
    read: { prefix: "", suffix: " ppbv", digits: 0 },
    ramp: {
      unit: "CO, ppbv",
      range: [50, 300],
      ends: ["Clean", "Heavy"],
      stops: [
        [0, [40, 20, 110]],
        [0.15, [30, 90, 200]],
        [0.3, [40, 180, 220]],
        [0.45, [60, 190, 90]],
        [0.6, [240, 230, 50]],
        [0.75, [250, 140, 30]],
        [0.88, [215, 40, 25]],
        [1, [165, 15, 35]],
      ],
    },
  },
  smoke: {
    label: "Smoke",
    days: 1,
    note: "Thick smoke and dust seen from space. Red is the thickest.",
    read: { prefix: "AI ", suffix: "", digits: 1, floor: 2 },
    ramp: {
      unit: "Aerosol index",
      range: [2, 5],
      ends: ["Thick", "Thickest"],
      // Below 2 is cloud and sun-glint noise, left clear, so only thick smoke glows.
      soft: 0.2,
      stops: [
        [0, [150, 90, 30]],
        [0.4, [232, 163, 23]],
        [0.62, [242, 107, 29]],
        [0.82, [217, 38, 28]],
        [1, [165, 15, 35]],
      ],
    },
  },
};

export const GLOBE_CREDIT = "NASA GIBS: AIRS and OMPS · Map: OpenFreeMap, OpenStreetMap";

/**
 * The date of each frame, oldest first, and `before` more days ahead of them. The satellites pass over around 1:30pm
 * and NASA publishes about three hours later, so today's pass is used from 5pm SGT.
 */
export function globeDates(now: number, before = 0): string[] {
  const newest = sgHour(now) >= 17 ? 0 : -1;
  return Array.from({ length: FRAMES + before }, (_, k) => sgDate(newest - FRAMES - before + 1 + k, new Date(now)));
}

/** A week, in days. */
export const WEEK = 7;

/** Whether `date` (YYYY-MM-DD, SGT) is older than 2 days, so that NASA adds no more passes to it. */
export const isSettled = (date: string) => date < sgDate(-2);

/** The date a week before `date` (YYYY-MM-DD, SGT). */
export const weekBefore = (date: string) => sgDate(-WEEK, new Date(`${date}T12:00:00+08:00`));

/** The days a layer's frame for `date` averages, oldest first. */
export function globeDays(layer: GlobeLayer, date: string): string[] {
  const { days } = GLOBE_LAYERS[layer];
  const end = new Date(`${date}T12:00:00+08:00`);
  return Array.from({ length: days }, (_, k) => sgDate(k + 1 - days, end));
}

/** The picture laid over the map, and shown flat as the poster until the map loads: the whole world in Web Mercator. No `date` is the newest frame. */
export const globePicture = (layer: GlobeLayer, date?: string) => `/api/globe/${layer}${date ? `?date=${date}` : ""}`;

/** Each day's mean reading over Singapore, by date: a week more than the frames show, for the change on a week earlier. */
export const globeSeries = (layer: GlobeLayer) => `/api/globe/${layer}/series`;

/** The colour of `t` (0 to 1) along a ramp. */
export function rampRgb({ stops }: Ramp, t: number): Rgb {
  const i = Math.max(1, stops.findIndex(([at]) => t <= at));
  const [a, ca] = stops[i - 1];
  const [b, cb] = stops[i];
  const s = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * s)) as Rgb;
}

/** Where a value falls along a ramp, 0 to 1. */
export function rampT({ range: [lo, hi] }: Ramp, value: number) {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** A CSS gradient of a ramp, for the legend. */
export const rampCss = ({ stops }: Ramp) => `linear-gradient(to right, ${stops.map(([t, c]) => `rgb(${c}) ${t * 100}%`).join(", ")})`;

/** Is `value` too faint to count, so that the layer draws nothing there? */
export const isClear = (layer: GlobeLayer, value: number) => value < (GLOBE_LAYERS[layer].read.floor ?? -Infinity);

/** A reading as text: "238 ppbv", "AI 3.1" or "clear". `rough` rounds coarsely and says "about", for a value read back from a picture, whose colours stop at the top of the ramp. */
export function fmtReading(layer: GlobeLayer, value: number, rough = false) {
  const { read, ramp } = GLOBE_LAYERS[layer];
  if (isClear(layer, value)) return "clear";
  const unit = (rough ? 5 : 1) / 10 ** read.digits;
  const text = rough && value >= ramp.range[1] ? `over ${ramp.range[1]}` : `${rough ? "about " : ""}${(Math.round(value / unit) * unit).toFixed(read.digits)}`;
  return `${read.prefix}${text}${read.suffix}`;
}
