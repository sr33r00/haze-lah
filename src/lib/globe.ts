import { SG, sgDate, sgHour } from "./util";

// The 3D globe of NASA pollution data: carbon monoxide and smoke textures drawn by /api/globe/[layer] from
// NASA GIBS. Pure config, shared by the server and the browser.

export type GlobeLayer = "co" | "smoke";
type Rgb = [number, number, number];

/** Colour stops from t = 0 (`range[0]`) to t = 1 (`range[1]`), what the colours mean and the words for each end. */
type Ramp = { unit: string; range: [number, number]; ends: [string, string]; stops: [t: number, rgb: Rgb][] };

/** The area the flat poster shows, behind the globe, centred on Singapore and 3:2: [south, west, north, east]. */
export const REGION = [SG.lat - 20, SG.lon - 30, SG.lat + 20, SG.lon + 30] as const;

/** One frame per day, the last week up to the newest. */
export const FRAMES = 8;

export const GLOBE_LAYERS = {
  co: {
    label: "Carbon monoxide",
    days: 3,
    note: "Carbon monoxide about 5.5 km up, averaged over 3 days. It comes from burning: red is heavy.",
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
        [1, [120, 10, 10]],
      ],
    } satisfies Ramp,
  },
  smoke: {
    label: "Smoke",
    days: 1,
    note: "Thick smoke and dust seen from space. Red is the thickest.",
    ramp: {
      unit: "Aerosol index",
      range: [2, 5],
      ends: ["Thick", "Thickest"],
      // Below 2 is cloud and sun-glint noise, drawn as the dark of the stage, so only thick smoke glows.
      stops: [
        [0, [13, 22, 38]],
        [0.04, [13, 22, 38]],
        [0.18, [150, 90, 30]],
        [0.4, [232, 163, 23]],
        [0.62, [242, 107, 29]],
        [0.82, [217, 38, 28]],
        [1, [122, 10, 20]],
      ],
    } satisfies Ramp,
  },
} satisfies Record<GlobeLayer, { label: string; days: number; note: string; ramp: Ramp }>;

export const GLOBE_CREDIT = "NASA GIBS: AIRS and OMPS";

/**
 * The date of each frame, oldest first. The satellites pass over around 1:30pm and NASA publishes about three
 * hours later, so today's pass is used from 5pm SGT.
 */
export function globeDates(now: number): string[] {
  const newest = sgHour(now) >= 17 ? 0 : -1;
  return Array.from({ length: FRAMES }, (_, k) => sgDate(newest - FRAMES + 1 + k, new Date(now)));
}

/** The days a layer's frame for `date` averages, oldest first. */
export function globeDays(layer: GlobeLayer, date: string): string[] {
  const { days } = GLOBE_LAYERS[layer];
  const end = new Date(`${date}T12:00:00+08:00`);
  return Array.from({ length: days }, (_, k) => sgDate(k + 1 - days, end));
}

/** The equirectangular picture wrapped round the globe, and shown flat as the poster until the globe loads. No `date` is the newest frame. */
export const globeTexture = (layer: GlobeLayer, date?: string) => `/api/globe/${layer}${date ? `?date=${date}` : ""}`;

/** The colour of `t` (0 to 1) along a ramp. */
export function rampRgb({ stops }: Ramp, t: number): Rgb {
  const i = Math.max(1, stops.findIndex(([at]) => t <= at));
  const [a, ca] = stops[i - 1];
  const [b, cb] = stops[i];
  const s = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * s)) as Rgb;
}

/** A CSS gradient of a ramp, for the legend. */
export const rampCss = ({ stops }: Ramp) => `linear-gradient(to right, ${stops.map(([t, c]) => `rgb(${c}) ${t * 100}%`).join(", ")})`;
