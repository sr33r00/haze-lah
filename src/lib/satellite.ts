
// NASA GIBS satellite images (public domain). Pure URL building: the browser loads the images straight from NASA.
import { sgDate, shiftDate } from "./util";

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
/** Sumatra to Borneo, matching the smoke map: [south, west, north, east]. */
export const SAT_BOX = [-6, 95, 7, 120] as const;
/** The whole Earth in the same order. */
const WORLD_BOX = [-90, -180, 90, 180] as const;
type Box = readonly [south: number, west: number, north: number, east: number];

/** A WMS GetMap URL for `layers` over `box` (the whole Earth by default), at `w` by `h` pixels. */
export function gibsMap(layers: string, w: number, h: number, opts: { box?: Box; format?: "jpeg" | "png"; time?: string } = {}) {
  const { box = WORLD_BOX, format = "jpeg", time } = opts;
  const q = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    CRS: "EPSG:4326",
    BBOX: box.join(","),
    WIDTH: String(w),
    HEIGHT: String(h),
    FORMAT: `image/${format}`,
    LAYERS: layers,
    ...(format === "png" && { TRANSPARENT: "true" }),
    ...(time && { TIME: time }),
  });
  return `${WMS}?${q}`;
}

/** Where a point sits on an image of `box`, as percentages from the left and top. */
export const onImage = (lat: number, lon: number, box: Box = SAT_BOX) => ({
  x: ((lon - box[1]) / (box[3] - box[1])) * 100,
  y: ((box[2] - lat) / (box[2] - box[0])) * 100,
});

/** Size in px of every picture of `SAT_BOX` the page shows (the relief, the Himawari pictures, the smoke thickness): about 1000 px wide keeps them fast. */
export const SAT_SIZE = { w: 1000, h: 520 } as const;
/** `SAT_SIZE` as a CSS aspect ratio, to reserve the picture's box before it loads. */
export const SAT_ASPECT = `${SAT_SIZE.w} / ${SAT_SIZE.h}`;

/**
 * Relief map of `SAT_BOX` with coastlines, 1000×520. It never changes, so it ships with the site instead of costing a
 * 2 s NASA request per visit; made with gibsMap("BlueMarble_ShadedRelief_Bathymetry,Coastlines_15m", 1000, 520, { box: SAT_BOX }).
 */
export const RELIEF = "/relief.jpg";

/** The Himawari-9 band the page shows: Band 3, red light at 1 km, where smoke is a smooth grey-brown veil. It has pictures by day only. */
export const HIMAWARI_LAYER = "Himawari_AHI_Band3_Red_Visible_1km";

const HIMAWARI_STEP = 600_000; // GIBS has a Himawari picture every 10 minutes ...
const HIMAWARI_DELAY = 3600_000; // ... about 40 to 60 minutes after it was taken
/** How many pictures the loop holds: the last 3 hours, every 10 minutes (18 steps, so 19 pictures). */
export const HIMAWARI_FRAMES = 19;

/** The times (ISO, "YYYY-MM-DDTHH:MM:00Z") of the loop's pictures, oldest first: the newest GIBS should have by `now` (ms), and the ones before it. */
export function himawariTimes(now = Date.now(), count = HIMAWARI_FRAMES) {
  const latest = Math.floor((now - HIMAWARI_DELAY) / HIMAWARI_STEP) * HIMAWARI_STEP;
  return Array.from({ length: count }, (_, k) => `${new Date(latest - (count - 1 - k) * HIMAWARI_STEP).toISOString().slice(0, 16)}:00Z`);
}

const DAYLIGHT_FROM = 7 * 60 + 30; // minutes into the Singapore day: 07:30 ...
const DAYLIGHT_TO = 18 * 60 + 30; // ... to 18:30. Sunrise and sunset fall between about 06:30 and 19:30 across Sumatra and Borneo; the sun is low at both ends, so the window is trimmed.
const MIN_DAY_FRAMES = 6; // fewer daylight pictures than this (an hour) is not worth a loop
const NIGHT_REPLAY_END = 17 * 60 + 30; // the night loop ends at 17:30 SGT (so it runs 14:30 to 17:30): the last hour before 18:30 is too dark to read smoke

/** Minutes into the Singapore day at `t`. */
const sgMinutes = (t: string | number | Date) => {
  const d = new Date(t);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % (24 * 60);
};

/** Whether the time `t` is daylight over `SAT_BOX`, when the visible band has pictures: 07:30 to 18:30 Singapore time. */
export function isDaylight(t: string | number | Date) {
  const minutes = sgMinutes(t);
  return minutes >= DAYLIGHT_FROM && minutes <= DAYLIGHT_TO;
}

/**
 * The times of the visible band's loop at `now` (ms), oldest first: the daylight pictures of the last 3 hours (`himawariTimes`). With
 * fewer than an hour of them (the night, and the first hour after sunrise) it is the 3 hours up to the latest `NIGHT_REPLAY_END` instead, and `night` is true.
 */
export function visibleTimes(now = Date.now(), count = HIMAWARI_FRAMES) {
  const recent = himawariTimes(now, count);
  const day = recent.filter(isDaylight);
  // Daytime only while the newest picture is still in daylight: after sunset, a few dusk pictures left in the window are night.
  if (isDaylight(recent.at(-1)!) && day.length >= MIN_DAY_FRAMES) return { times: day, night: false };
  let end = Date.parse(recent.at(-1)!); // the latest 17:30 SGT picture, stepping back 10 minutes at a time
  while (sgMinutes(end) !== NIGHT_REPLAY_END) end -= HIMAWARI_STEP;
  return { times: himawariTimes(end + HIMAWARI_DELAY, count), night: true };
}

/** One Himawari picture of `SAT_BOX` at `time` (an entry of `himawariTimes`), with coastlines. GIBS answers a time it does not have with a black picture, not an error. */
export const himawariUrl = (time: string) => gibsMap(`${HIMAWARI_LAYER},Coastlines_15m`, SAT_SIZE.w, SAT_SIZE.h, { box: SAT_BOX, time });

/**
 * NASA's three VIIRS Deep Blue aerosol optical depth layers, one per satellite (NOAA-20, NOAA-21, Suomi NPP). Their passes are at
 * different times and their swaths overlap differently, and WMS draws comma-separated layers in order, so stacked they fill each other's gaps.
 */
export const AOD_LAYERS = ["VIIRS_NOAA20_AOD_Deep_Blue_Land_Ocean", "VIIRS_NOAA21_AOD_Deep_Blue_Land_Ocean", "VIIRS_SNPP_AOD_Deep_Blue_Land_Ocean"] as const;

/** How many SGT days the smoke thickness picture goes back, today included. */
export const AOD_DAYS = 7;

/** The SGT dates (YYYY-MM-DD) of the smoke thickness pictures, oldest first, the last being `today`. */
export const aodDates = (today = sgDate()) => Array.from({ length: AOD_DAYS }, (_, k) => shiftDate(today, k + 1 - AOD_DAYS));

/**
 * The smoke thickness of SGT `date` over `SAT_BOX`: the VIIRS aerosol layers with coastlines, a PNG with transparency (draw it over `RELIEF`,
 * so that gaps show land). NASA posts each day some hours to days late; for a day it has not posted, GIBS answers with the coastlines alone.
 */
export const aodUrl = (date: string) => gibsMap([...AOD_LAYERS, "Coastlines_15m"].join(","), SAT_SIZE.w, SAT_SIZE.h, { box: SAT_BOX, format: "png", time: date });

/** The top of the aerosol optical depth colour scale the key shows; the palette itself runs to 5, and its last bands differ by a few shades of dark red. */
export const AOD_MAX = 3;

/**
 * NASA's colour for each aerosol optical depth, for the key: [value, colour] read from the GIBS colour map `MODIS_VIIRS_AOD`
 * (https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_VIIRS_AOD.xml, the one the three layers' legends name), taking the colour of the band each value falls in.
 */
export const AOD_STOPS: readonly (readonly [value: number, colour: string])[] = [
  [0, "#fffcc7"],
  [0.05, "#fff293"],
  [0.1, "#ffe576"],
  [0.15, "#ffd85e"],
  [0.2, "#ffc648"],
  [0.3, "#ff9528"],
  [0.4, "#ff621b"],
  [0.5, "#f52810"],
  [0.6, "#d3070c"],
  [0.7, "#9b000e"],
  [1, "#9b000e"],
  [2, "#92000e"],
  [3, "#8c000e"],
];
