
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

/** The Himawari-9 bands GIBS serves, as the picker lists them: `layer` is the GIBS layer, `note` what to say when a band has no picture. */
export const HIMAWARI_BANDS = [
  { id: "infrared", label: "Infrared", layer: "Himawari_AHI_Band13_Clean_Infrared", note: null },
  { id: "visible", label: "Visible", layer: "Himawari_AHI_Band3_Red_Visible_1km", note: "Visible images are daytime only" },
  { id: "airmass", label: "Air mass", layer: "Himawari_AHI_Air_Mass", note: null },
] as const;
export type HimawariBand = (typeof HIMAWARI_BANDS)[number]["id"];

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

/** One Himawari picture of `SAT_BOX` at `time` (an entry of `himawariTimes`), with coastlines. GIBS answers a time it does not have with a black picture, not an error. */
export const himawariUrl = (layer: string, time: string) =>
  gibsMap(`${layer},Coastlines_15m`, HIMAWARI_SIZE.w, HIMAWARI_SIZE.h, { box: SAT_BOX, time });
