import { SG, sgDate } from "./util";

// NASA GIBS satellite images of the region (public domain; Himawari-9 data from the Japan Meteorological Agency).
// Pure URL building: the browser loads the images straight from NASA, and nothing is stored.

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
/** Sumatra to Borneo, matching the smoke map: [south, west, north, east]. */
export const SAT_BOX = [-6, 95, 7, 120] as const;
const SIZE = { w: 1000, h: 520 }; // same shape as the box

// Data layers sit between relief and coastlines; where no satellite passed, the relief shows through.
const BASE = "BlueMarble_ShadedRelief_Bathymetry";
const COAST = "Coastlines_15m";
const over = (data: string) => `${BASE},${data},${COAST}`;
const LIVE = `Himawari_AHI_Band3_Red_Visible_1km,${COAST}`;

/** How a layer is read: colour chips, or a gradient from `low` to `high` with a short plain-English `note`. */
export type SatLegend =
  | { chips: [color: string, name: string][] }
  | { stops: string[]; low: string; high: string; unit: string; note: string };

/** The daily layers the viewer can switch between. */
export const SAT_LAYERS = {
  true: {
    label: "True colour",
    layers: `VIIRS_NOAA20_CorrectedReflectance_TrueColor,VIIRS_NOAA20_Thermal_Anomalies_375m_All,${COAST}`,
    legend: {
      chips: [
        ["#a89a84", "Smoke, grey-brown veil"],
        ["#e5322d", "Fires"],
      ],
    },
  },
  smoke: {
    label: "Smoke",
    // Two OMPS satellites, stacked so one fills the other's gaps.
    layers: over("OMPS_NOAA21_NadirMapper_AerosolIndex_380,OMPS_NOAA20_NadirMapper_AerosolIndex_380"),
    legend: {
      stops: ["#ececde", "#dcdc89", "#f1f000", "#ed5300", "#eb0c00", "#c50002", "#a30024"],
      low: "0",
      high: "5+",
      unit: "Aerosol index",
      note: "Smoke and dust high enough to see from space. Red is thick smoke.",
    },
  },
  co: {
    label: "Carbon monoxide",
    // Night and day passes, stacked to fill the swath gaps.
    layers: over("AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Night,AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day"),
    legend: {
      stops: ["#fffdd3", "#fde27d", "#fd9250", "#eb4939", "#b4241b", "#9f2479", "#8a34f0", "#4d1784"],
      low: "0",
      high: "350+",
      unit: "CO, ppbv",
      note: "Carbon monoxide about 5.5 km up, from burning. Purple is heavy smoke pollution; blank strips had no satellite pass.",
    },
  },
} satisfies Record<string, { label: string; layers: string; legend: SatLegend }>;

export type SatLayer = keyof typeof SAT_LAYERS;

const H = 3600_000;
const SGT = 8 * H;

function getMap(layers: string, time?: string) {
  const q = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    CRS: "EPSG:4326",
    BBOX: SAT_BOX.join(","),
    WIDTH: String(SIZE.w),
    HEIGHT: String(SIZE.h),
    FORMAT: "image/jpeg",
    LAYERS: layers,
    ...(time && { TIME: time }),
  });
  return `${WMS}?${q}`;
}

const worldview = (layers: string, time: string) =>
  `https://worldview.earthdata.nasa.gov/?v=${SAT_BOX[1]},${SAT_BOX[0]},${SAT_BOX[3]},${SAT_BOX[2]}&l=${layers}&t=${time}`;

/** Where a point sits on the images, as percentages from the left and top. */
export const onImage = (lat: number, lon: number) => ({
  x: ((lon - SAT_BOX[1]) / (SAT_BOX[3] - SAT_BOX[1])) * 100,
  y: ((SAT_BOX[2] - lat) / (SAT_BOX[2] - SAT_BOX[0])) * 100,
});

/** Where Singapore sits on the images. */
export const SG_ON_IMAGE = onImage(SG.lat, SG.lon);

/** Relief map of the region with coastlines, the same every day. */
export const baseImage = () => getMap(`${BASE},${COAST}`);

export type SatImage = { url: string; time: string; link: string };

/**
 * One image of `layer` per day, newest first. The satellites pass over around 1:30pm and NASA publishes about three
 * hours later, so today's image is used from 5pm SGT.
 */
export function dailyImages(layer: SatLayer, now = Date.now(), days = 5): SatImage[] {
  const { layers } = SAT_LAYERS[layer];
  const first = new Date(now + SGT).getUTCHours() >= 17 ? 0 : -1;
  return Array.from({ length: days }, (_, k) => {
    const date = sgDate(first - k, new Date(now));
    return { url: getMap(layers, date), time: date, link: worldview(layers, date) };
  });
}

/**
 * The newest Himawari visible image (every 10 minutes, about an hour behind). Visible light needs daylight, so at
 * night it falls back to 2pm SGT of the last day.
 */
export function liveImage(now = Date.now()): SatImage {
  let t = Math.floor((now - H) / (10 * 60_000)) * 10 * 60_000;
  const hour = new Date(t + SGT).getUTCHours();
  if (hour < 9 || hour >= 17) {
    const day = Date.parse(`${sgDate(0, new Date(t))}T14:00:00+08:00`);
    t = day <= t ? day : day - 24 * H;
  }
  const time = new Date(t).toISOString().slice(0, 19) + "Z";
  return { url: getMap(LIVE, time), time, link: worldview(LIVE, time) };
}
