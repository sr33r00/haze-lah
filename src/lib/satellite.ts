
// NASA GIBS satellite images (public domain). Pure URL building: the browser loads the images straight from NASA.

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

/**
 * Relief map of `SAT_BOX` with coastlines, 1000×520. It never changes, so it ships with the site instead of costing a
 * 2 s NASA request per visit; made with gibsMap("BlueMarble_ShadedRelief_Bathymetry,Coastlines_15m", 1000, 520, { box: SAT_BOX }).
 */
export const RELIEF = "/relief.jpg";

/** The Himawari-9 band the page shows: Band 3, red light at 1 km, where smoke is a smooth grey-brown veil. It has pictures by day only. */
export const HIMAWARI_LAYER = "Himawari_AHI_Band3_Red_Visible_1km";

/** Size of a Himawari picture: about 1000 px wide keeps it fast, and the shape is that of `SAT_BOX`. */
export const HIMAWARI_SIZE = { w: 1000, h: 520 } as const;
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

/** Whether the time `t` is daylight over `SAT_BOX`, when the visible band has pictures: 07:30 to 18:30 Singapore time. */
export function isDaylight(t: string | number | Date) {
  const d = new Date(t);
  const minutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % (24 * 60);
  return minutes >= DAYLIGHT_FROM && minutes <= DAYLIGHT_TO;
}

/**
 * The times of the visible band's loop at `now` (ms), oldest first: the daylight pictures of the last 3 hours (`himawariTimes`). With
 * fewer than an hour of them (the night, and the first hour after sunrise) it is the last 3 hours of daylight instead, and `night` is true.
 */
export function visibleTimes(now = Date.now(), count = HIMAWARI_FRAMES) {
  const recent = himawariTimes(now, count);
  const day = recent.filter(isDaylight);
  // Daytime only while the newest picture is still in daylight: after sunset, a few dusk pictures left in the window are night.
  if (isDaylight(recent.at(-1)!) && day.length >= MIN_DAY_FRAMES) return { times: day, night: false };
  let end = Date.parse(recent.at(-1)!); // the newest picture in daylight, stepping back 10 minutes at a time
  while (!isDaylight(end)) end -= HIMAWARI_STEP;
  return { times: himawariTimes(end + HIMAWARI_DELAY, count), night: true };
}

/** One Himawari picture of `SAT_BOX` at `time` (an entry of `himawariTimes`), with coastlines. GIBS answers a time it does not have with a black picture, not an error. */
export const himawariUrl = (time: string) => gibsMap(`${HIMAWARI_LAYER},Coastlines_15m`, HIMAWARI_SIZE.w, HIMAWARI_SIZE.h, { box: SAT_BOX, time });
