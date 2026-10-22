import { mercY } from "@/lib/globe";
import { POLLUTANTS, colorOf, type PollutantId } from "@/lib/pollutants";
import type { SmokeGrid } from "@/lib/types";

type Grid = Pick<SmokeGrid, "lats" | "lons">;

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Catmull-Rom weights of four neighbours, for a position `t` between the middle two. */
const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

/** Value at `lat`, `lon` of one time step, interpolated bicubically so that the 1 degree cells do not show. Never negative or NaN. */
export function sampleGrid({ lats, lons }: Grid, data: number[], lat: number, lon: number) {
  const fy = Math.min(lats.length - 1.0001, Math.max(0, ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1)));
  const fx = Math.min(lons.length - 1.0001, Math.max(0, ((lon - lons[0]) / (lons[lons.length - 1] - lons[0])) * (lons.length - 1)));
  const y = Math.floor(fy);
  const x = Math.floor(fx);
  const at = (r: number, c: number) => data[Math.min(lats.length - 1, Math.max(0, r)) * lons.length + Math.min(lons.length - 1, Math.max(0, c))] || 0; // a missing cell reads as 0
  const row = (r: number) => cubic(at(r, x - 1), at(r, x), at(r, x + 1), at(r, x + 2), fx - x);
  return Math.max(0, cubic(row(y - 1), row(y), row(y + 1), row(y + 2), fy - y));
}

const PX_PER_DEG = 48;
const FEATHER = 2.2; // degrees: the field fades to nothing this far in from the grid's edge, so there is no box

/** The grid's corners as MapLibre wants them for a Web Mercator picture: NW, NE, SE, SW. */
export function fieldCorners({ lats, lons }: Grid): [[number, number], [number, number], [number, number], [number, number]] {
  const [s, n, w, e] = [lats[0], lats[lats.length - 1], lons[0], lons[lons.length - 1]];
  return [[w, n], [e, n], [e, s], [w, s]];
}

/** RGBA pixels of one time step of the grid, rows in Web Mercator as the map places them: smooth, transparent where the air is clean. */
export function fieldPixels(grid: Grid, data: number[], pollutant: PollutantId) {
  const p = POLLUTANTS.find((q) => q.id === pollutant)!;
  const { lats, lons } = grid;
  const [s, n, w, e] = [lats[0], lats[lats.length - 1], lons[0], lons[lons.length - 1]];
  const width = Math.round((e - w) * PX_PER_DEG);
  const yN = mercY(n);
  const yS = mercY(s);
  const height = Math.round((width * (yS - yN)) / ((e - w) / 360));
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    const m = yN + ((py + 0.5) / height) * (yS - yN); // Web Mercator y, 0..1
    const lat = (Math.atan(Math.sinh((0.5 - m) * 2 * Math.PI)) * 180) / Math.PI;
    for (let px = 0; px < width; px++) {
      const lon = w + ((px + 0.5) / width) * (e - w);
      const edge = Math.min(lat - s, n - lat, lon - w, e - lon);
      const fade = smoother(Math.min(1, Math.max(0, edge / FEATHER)));
      const [r, g, b, a] = colorOf(p, sampleGrid(grid, data, lat, lon));
      pixels.set([r, g, b, a * fade * 255], (py * width + px) * 4);
    }
  }
  return { width, height, pixels };
}

/** Draws one time step of the grid on `canvas` (made if none is given), sized to fit: for a MapLibre canvas source placed at `fieldCorners`. */
export function drawField(grid: Grid, data: number[], pollutant: PollutantId, canvas = document.createElement("canvas")): HTMLCanvasElement {
  const { width, height, pixels } = fieldPixels(grid, data, pollutant);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

/**
 * Makes pixels transparent that show an aerosol index below 2, in place (RGBA). NASA's colours run from pale yellow (about 0) through
 * yellow (2) to orange, red and brown (5 and up) (colour map OMPS_Aerosol_Index, https://gibs.earthdata.nasa.gov/colormaps/v1.3/OMPS_Aerosol_Index.xml),
 * and below 2 is cloud and sun-glint noise, not smoke (the same floor as the server's picture, GLOBE_LAYERS.smoke.ramp.range in globe.ts).
 * Those low values are the pale ones: blue above 10 with green above 150 (AI 2 itself is 237,235,0; AI 4.5 and 5 are red with green 0).
 */
export function clearNoise(rgba: Uint8ClampedArray) {
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 2] > 10 && rgba[i + 1] > 150) rgba[i + 3] = 0;
}
