import { SG } from "./util";

// NASA GIBS satellite images (public domain). Pure URL building: the browser loads the images straight from NASA.

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
/** Sumatra to Borneo, matching the smoke map: [south, west, north, east]. */
export const SAT_BOX = [-6, 95, 7, 120] as const;
/** The whole Earth in the same order. */
export const WORLD_BOX = [-90, -180, 90, 180] as const;
type Box = readonly [south: number, west: number, north: number, east: number];

/** Coastline overlay, also fetched on its own and drawn over the globe textures. */
export const COAST = "Coastlines_15m";

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

/** Where Singapore sits on the images of `SAT_BOX`. */
export const SG_ON_IMAGE = onImage(SG.lat, SG.lon);

/**
 * Relief map of `SAT_BOX` with coastlines, 1000×520. It never changes, so it ships with the site instead of costing a
 * 2 s NASA request per visit; made with gibsMap("BlueMarble_ShadedRelief_Bathymetry,Coastlines_15m", 1000, 520, { box: SAT_BOX }).
 */
export const RELIEF = "/relief.jpg";
