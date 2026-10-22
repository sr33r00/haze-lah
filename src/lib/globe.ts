import { sgDate, sgHour } from "./util";

// The globe of NASA pollution data: carbon monoxide and smoke pictures drawn by /api/globe/[layer] from NASA GIBS. Pure config, shared by the server and the browser.

export type GlobeLayer = "co" | "smoke";
type Rgb = [number, number, number];

/**
 * Colour stops from t = 0 (`range[0]`) to t = 1 (`range[1]`), what the colours mean and the words for each end.
 * With `soft`, the picture fades out below that t, so that nothing is drawn where there is none of it.
 */
type Ramp = { unit: string; range: [number, number]; ends: [string, string]; stops: [t: number, rgb: Rgb][]; soft?: number };

/** The pictures are Web Mercator squares, as MapLibre places images: the latitude the square ends at, north and south. */
const MERC_LAT = 85.0511;

/** The corners of such a square, NW, NE, SE, SW, for a MapLibre image source. */
export const WORLD_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [[-180, MERC_LAT], [180, MERC_LAT], [180, -MERC_LAT], [-180, -MERC_LAT]];

/** How far down a Web Mercator square of the world `lat` sits, from 0 (top) to 1. */
export const mercY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/** One frame per day, the last week up to the newest. */
const FRAMES = 8;

/** What a layer is: how many days it averages and its colours. */
type Layer = { days: number; ramp: Ramp };

export const GLOBE_LAYERS: Record<GlobeLayer, Layer> = {
  co: {
    days: 3,
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
    days: 1,
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

/** The layers, the default first. */
export const LAYERS = Object.keys(GLOBE_LAYERS) as GlobeLayer[];

/**
 * The date of each frame, oldest first. The satellites pass over around 1:30pm
 * and NASA publishes about three hours later, so today's pass is used from 5pm SGT.
 */
export function globeDates(now: number): string[] {
  const newest = sgHour(now) >= 17 ? 0 : -1;
  return Array.from({ length: FRAMES }, (_, k) => sgDate(newest - FRAMES + 1 + k, new Date(now)));
}

/** NASA GIBS tiles in Web Mercator (EPSG:3857), the "best" product line. */
export const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** The highest zoom of the smoke tiles (the tile matrix set below stops there). */
export const SMOKE_TILE_ZOOM = 6;

/**
 * Tiles of NASA's smoke picture for `date` (YYYY-MM-DD), straight from GIBS, for days the server picture (`globePicture`) does not
 * have. Layer id and tile matrix set from GIBS GetCapabilities, https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
 * (checked 2026-10-23): OMPS_NOAA20_NadirMapper_AerosolIndex_380 is the OMPS Nadir Mapper aerosol index at 380 nm (NOAA-20), daily
 * from 2025-04-28, PNG, GoogleMapsCompatible_Level6. It is the same layer the server picture is built from, in NASA's own colours.
 */
export const smokeTiles = (date: string) => `${GIBS_WMTS}/OMPS_NOAA20_NadirMapper_AerosolIndex_380/default/${date}/GoogleMapsCompatible_Level${SMOKE_TILE_ZOOM}/{z}/{y}/{x}.png`;

/** Whether `date` (YYYY-MM-DD, SGT) is older than 2 days, so that NASA adds no more passes to it. */
export const isSettled = (date: string) => date < sgDate(-2);

/** The days a layer's frame for `date` averages, oldest first. */
export function globeDays(layer: GlobeLayer, date: string): string[] {
  const { days } = GLOBE_LAYERS[layer];
  const end = new Date(`${date}T12:00:00+08:00`);
  return Array.from({ length: days }, (_, k) => sgDate(k + 1 - days, end));
}

/** The picture laid over the map, and shown flat as the poster until the map loads: the whole world in Web Mercator. No `date` is the newest frame. */
export const globePicture = (layer: GlobeLayer, date?: string) => `/api/globe/${layer}${date ? `?date=${date}` : ""}`;

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
