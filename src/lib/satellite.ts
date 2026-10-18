import { SG, sgDate } from "./util";

// NASA GIBS satellite images of the region (public domain; Himawari-9 data from the Japan Meteorological Agency).
// Pure URL building: the browser loads the images straight from NASA, and nothing is stored.

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
/** Sumatra to Borneo, matching the smoke map: [south, west, north, east]. */
export const SAT_BOX = [-6, 95, 7, 120] as const;
const SIZE = { w: 1000, h: 520 }; // same shape as the box

const DAILY = "VIIRS_NOAA20_CorrectedReflectance_TrueColor,VIIRS_NOAA20_Thermal_Anomalies_375m_All,Coastlines_15m";
const LIVE = "Himawari_AHI_Band3_Red_Visible_1km,Coastlines_15m";

const H = 3600_000;
const SGT = 8 * H;

function getMap(layers: string, time: string) {
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
    TIME: time,
  });
  return `${WMS}?${q}`;
}

/** Where Singapore sits on the images, as percentages from the left and top. */
export const SG_ON_IMAGE = {
  x: ((SG.lon - SAT_BOX[1]) / (SAT_BOX[3] - SAT_BOX[1])) * 100,
  y: ((SAT_BOX[2] - SG.lat) / (SAT_BOX[2] - SAT_BOX[0])) * 100,
};

export type SatImage = { url: string; time: string; link: string };

/**
 * True-colour images, one per day, newest first. NOAA-20 passes over around 1:30pm and NASA publishes about three
 * hours later, so today's image is used from 5pm SGT.
 */
export function dailyImages(now = Date.now(), days = 5): SatImage[] {
  const first = new Date(now + SGT).getUTCHours() >= 17 ? 0 : -1;
  return Array.from({ length: days }, (_, k) => {
    const date = sgDate(first - k, new Date(now));
    return {
      url: getMap(DAILY, date),
      time: date,
      link: `https://worldview.earthdata.nasa.gov/?v=${SAT_BOX[1]},${SAT_BOX[0]},${SAT_BOX[3]},${SAT_BOX[2]}&l=${DAILY}&t=${date}`,
    };
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
  return {
    url: getMap(LIVE, time),
    time,
    link: `https://worldview.earthdata.nasa.gov/?v=${SAT_BOX[1]},${SAT_BOX[0]},${SAT_BOX[3]},${SAT_BOX[2]}&l=${LIVE}&t=${time}`,
  };
}
