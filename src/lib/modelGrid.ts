/** The 1° regional model grid (CAMS smoke and 850 hPa wind): south to north, west to east. Shared by the fetch (`gridQuery`) and the smoke map, which keeps its view inside it. */
export const GRID = { lat: [-6, 7], lon: [95, 120], step: 1 };

/** The grid's box as [[south, west], [north, east]]. */
export const GRID_BOX: [[number, number], [number, number]] = [
  [GRID.lat[0], GRID.lon[0]],
  [GRID.lat[1], GRID.lon[1]],
];

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** The size in pixels at zoom 0 (a 256 px world) of a box given as [[south, west], [north, east]]. */
export function boxPixels([[s, w], [n, e]]: [[number, number], [number, number]]) {
  return { w: (256 * (e - w)) / 360, h: (256 * (mercatorY(n) - mercatorY(s))) / (2 * Math.PI) };
}

/**
 * The smallest zoom (a multiple of `snap`) at which `box` covers a map of `w` x `h` pixels, so that no edge of the box shows inside
 * it. Leaflet's `getBoundsZoom(box, true)` for a Web Mercator map, without the map.
 */
export function coverZoom(box: [[number, number], [number, number]], w: number, h: number, snap = 0.5) {
  const b = boxPixels(box);
  const zoom = Math.log2(Math.max(w / b.w, h / b.h));
  return Math.ceil(Math.round(zoom * 1e6) / 1e6 / snap) * snap;
}
