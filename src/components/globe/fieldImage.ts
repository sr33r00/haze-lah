import { mercY } from "@/lib/globe";
import { colorOf, pollutant, rampTop, type PollutantId } from "@/lib/pollutants";
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
/** The globe's picture needs fewer pixels: the grid is 1 degree, the picture is stretched smoothly on the GPU, and each step is drawn on the main thread. */
export const GLOBE_PX_PER_DEG = 24;
const FEATHER = 2.2; // degrees: the field fades to nothing this far in from the grid's edge, so there is no box
const TABLE = 2048; // steps of the colour table

/** The grid's corners as MapLibre wants them for a Web Mercator picture: NW, NE, SE, SW. */
export function fieldCorners({ lats, lons }: Grid): [[number, number], [number, number], [number, number], [number, number]] {
  const [s, n, w, e] = [lats[0], lats[lats.length - 1], lons[0], lons[lons.length - 1]];
  return [[w, n], [e, n], [e, s], [w, s]];
}

const tables = new Map<PollutantId, Float32Array>();
/** `colorOf` at TABLE + 1 even steps from 0 to the ramp's top, as red, green, blue and alpha (0..255) in a row, so that a pixel costs a lookup. */
function colorTable(id: PollutantId) {
  let t = tables.get(id);
  if (!t) {
    const p = pollutant(id);
    const top = rampTop(p);
    t = new Float32Array((TABLE + 1) * 4);
    for (let i = 0; i <= TABLE; i++) {
      const [r, g, b, a] = colorOf(p, (top * i) / TABLE);
      t.set([r, g, b, a * 255], i * 4);
    }
    tables.set(id, t);
  }
  return t;
}

/** Catmull-Rom weights (as in `cubic`) of the four neighbours at `t` between the middle two. */
const weights = (t: number): [number, number, number, number] => [0.5 * t * (-1 + t * (2 - t)), 1 + t * t * (-2.5 + 1.5 * t), 0.5 * t * (1 + t * (4 - 3 * t)), 0.5 * t * t * (t - 1)];

/**
 * RGBA pixels of one time step of the grid: smooth, transparent where the air is clean. By default the rows are in Web Mercator as
 * the map places them and the field fades out at the grid's edge. With `flat` (pixels per degree) it is a plain latitude and longitude
 * picture that runs to the edge, for an image of the grid's own box. `density` is the pixels per degree otherwise.
 * The values are those of `sampleGrid` (bicubic), found a whole row of the picture at a time: the grid is stretched across first, then down.
 */
export function fieldPixels(grid: Grid, data: number[], id: PollutantId, flat?: number, density = PX_PER_DEG) {
  const { lats, lons } = grid;
  const [nLat, nLon] = [lats.length, lons.length];
  const [s, n, w, e] = [lats[0], lats[nLat - 1], lons[0], lons[nLon - 1]];
  const width = Math.round((e - w) * (flat ?? density));
  const yN = mercY(n);
  const yS = mercY(s);
  const height = flat ? Math.round((n - s) * flat) : Math.round((width * (yS - yN)) / ((e - w) / 360));
  const pixels = new Uint8ClampedArray(width * height * 4);
  const table = colorTable(id);
  const scale = TABLE / rampTop(pollutant(id));
  const grid0 = new Float64Array(nLat * nLon);
  for (let i = 0; i < grid0.length; i++) grid0[i] = data[i] || 0; // a missing cell reads as 0

  // Across: each grid row stretched to the picture's width.
  const across = new Float64Array(nLat * width);
  const colEdge = new Float64Array(width);
  for (let px = 0; px < width; px++) {
    const lon = w + ((px + 0.5) / width) * (e - w);
    colEdge[px] = Math.min(lon - w, e - lon);
    const fx = Math.min(nLon - 1.0001, Math.max(0, ((lon - w) / (e - w)) * (nLon - 1)));
    const x = Math.floor(fx);
    const wt = weights(fx - x);
    const cols = [x - 1, x, x + 1, x + 2].map((c) => Math.min(nLon - 1, Math.max(0, c)));
    for (let r = 0; r < nLat; r++) across[r * width + px] = wt[0] * grid0[r * nLon + cols[0]] + wt[1] * grid0[r * nLon + cols[1]] + wt[2] * grid0[r * nLon + cols[2]] + wt[3] * grid0[r * nLon + cols[3]];
  }

  // Down: the four rows around each picture row, then the colour.
  for (let py = 0; py < height; py++) {
    const m = yN + ((py + 0.5) / height) * (yS - yN); // Web Mercator y, 0..1
    const lat = flat ? n - ((py + 0.5) / height) * (n - s) : (Math.atan(Math.sinh((0.5 - m) * 2 * Math.PI)) * 180) / Math.PI;
    const fy = Math.min(nLat - 1.0001, Math.max(0, ((lat - s) / (n - s)) * (nLat - 1)));
    const y = Math.floor(fy);
    const [a0, a1, a2, a3] = weights(fy - y);
    const [o0, o1, o2, o3] = [y - 1, y, y + 1, y + 2].map((r) => Math.min(nLat - 1, Math.max(0, r)) * width);
    const rowEdge = Math.min(lat - s, n - lat);
    for (let px = 0; px < width; px++) {
      const v = a0 * across[o0 + px] + a1 * across[o1 + px] + a2 * across[o2 + px] + a3 * across[o3 + px];
      const k = v > 0 ? Math.min(TABLE, Math.round(v * scale)) * 4 : 0;
      const edge = Math.min(rowEdge, colEdge[px]);
      const fade = flat || edge >= FEATHER ? 1 : smoother(Math.max(0, edge / FEATHER));
      const o = (py * width + px) * 4;
      pixels[o] = table[k];
      pixels[o + 1] = table[k + 1];
      pixels[o + 2] = table[k + 2];
      pixels[o + 3] = table[k + 3] * fade;
    }
  }
  return { width, height, pixels };
}

/** Draws one time step of the grid on `canvas` (made if none is given), sized to fit: for a MapLibre canvas source placed at `fieldCorners`, or with `flat` (see `fieldPixels`) for a plain picture of the grid's box. */
export function drawField(grid: Grid, data: number[], pollutant: PollutantId, canvas = document.createElement("canvas"), flat?: number, density?: number): HTMLCanvasElement {
  const { width, height, pixels } = fieldPixels(grid, data, pollutant, flat, density);
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
