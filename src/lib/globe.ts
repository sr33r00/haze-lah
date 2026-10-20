import { COAST, WORLD_BOX, gibsMap } from "./satellite";
import { sgDate, sgHour } from "./util";

// The 3D globe of NASA pollution data: carbon monoxide and smoke textures drawn by /api/globe/[layer] from
// NASA GIBS, and the true-colour photo loaded straight from NASA. Pure config, shared by the server and the browser.

export type GlobeLayer = "co" | "smoke" | "true";
type Rgb = [number, number, number];

/** Colour stops from t = 0 (`range[0]`) to t = 1 (`range[1]`), and what the colours mean. */
type Ramp = { unit: string; range: [number, number]; stops: [t: number, rgb: Rgb][] };

/** The area the flat poster shows, behind the globe: [south, west, north, east]. */
export const REGION = [-15, 80, 25, 140] as const;

export const GLOBE_LAYERS = {
  co: {
    label: "Carbon monoxide",
    days: 3,
    lag: 0,
    note: "Carbon monoxide about 5.5 km up, averaged over 3 days. It comes from burning: red is heavy.",
    ramp: {
      unit: "CO, ppbv",
      range: [50, 300],
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
    days: 2,
    lag: 0,
    note: "Smoke and dust seen from space, last 2 days. Red is thick smoke.",
    ramp: {
      unit: "Aerosol index",
      range: [1, 5],
      // Below the first bend it is the dark of the stage, so only smoke glows.
      stops: [
        [0, [13, 22, 38]],
        [0.12, [13, 22, 38]],
        [0.3, [150, 90, 30]],
        [0.5, [232, 163, 23]],
        [0.68, [242, 107, 29]],
        [0.85, [217, 38, 28]],
        [1, [122, 10, 20]],
      ],
    } satisfies Ramp,
  },
  true: {
    label: "True colour",
    days: 1,
    lag: 1, // a photo is only of the whole Earth once the day's orbits are done
    note: "Latest daily photo. Smoke is the grey-brown veil.",
    ramp: null,
  },
} satisfies Record<GlobeLayer, { label: string; days: number; lag: number; note: string; ramp: Ramp | null }>;

export const GLOBE_CREDIT = "NASA GIBS: AIRS, OMPS and VIIRS";

const TRUE_COLOUR = `VIIRS_NOAA20_CorrectedReflectance_TrueColor,${COAST}`;

/**
 * The days a layer averages, oldest first. The satellites pass over around 1:30pm and NASA publishes about three
 * hours later, so today's pass is used from 5pm SGT.
 */
export function globeDays(layer: GlobeLayer, now: number): string[] {
  const { days, lag } = GLOBE_LAYERS[layer];
  const newest = (sgHour(now) >= 17 ? 0 : -1) - lag;
  return Array.from({ length: days }, (_, k) => sgDate(newest - days + 1 + k, new Date(now)));
}

/** The equirectangular picture wrapped round the globe. */
export const globeTexture = (layer: GlobeLayer, now: number) =>
  layer === "true" ? gibsMap(TRUE_COLOUR, 2048, 1024, { time: globeDays(layer, now)[0] }) : `/api/globe/${layer}`;

/** The picture shown while the globe is not loaded, with the area it covers. True colour gets its own sharper crop. */
export const globePoster = (layer: GlobeLayer, now: number) =>
  layer === "true"
    ? { url: gibsMap(TRUE_COLOUR, 900, 600, { box: REGION, time: globeDays(layer, now)[0] }), box: REGION }
    : { url: globeTexture(layer, now), box: WORLD_BOX };

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
