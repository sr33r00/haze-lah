import sharp from "sharp";
import { GLOBE_LAYERS, READ_BOX, globeDays, isClear, rampRgb, rampT, type GlobeLayer } from "../globe";
import { gibsMap } from "../satellite";
import { SG, getText } from "../util";

// Pollution pictures for the map, built from NASA GIBS satellite passes. GIBS only serves each pass as a coloured
// picture, so the colours are turned back into values, the passes averaged and smoothed, and the result coloured
// again with our own ramp. Also each day's mean over Singapore, from tiny pictures of just that box. The routes that
// serve them cache each answer on the CDN.

type Source = {
  layers: string[]; // one picture per layer and day
  colormap: string;
  fill: boolean; // paint wide gaps between passes with the values around them; otherwise gaps read as "none"
};

const COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3";
const SOURCES: Record<GlobeLayer, Source> = {
  co: {
    layers: ["AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day", "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Night"],
    colormap: "AIRS_Carbon_Monoxide_Volume_Mixing_Ratio",
    fill: true,
  },
  smoke: {
    layers: ["OMPS_NOAA20_NadirMapper_AerosolIndex_380", "OMPS_NOAA21_NadirMapper_AerosolIndex_380"],
    colormap: "OMPS_Aerosol_Index",
    fill: false,
  },
};

const W = 1440; // the size of every pass: 0.25 degrees a pixel, about the sharpness of the instruments
const H = 720;
const SIZE = 2048; // the finished picture is this many pixels square, in Web Mercator: smooth and about 100 KB as WebP when zoomed to a city
const TINY = 16; // the passes of the box over Singapore are this many pixels square
const SIGMA = 5; // pixels of smoothing, about 1.25 degrees
const COARSE = 8; // gaps wider than that are filled on a picture this many times smaller

/** Pixel colour (r << 16 | g << 8 | b) to the middle of the value range it stands for. */
async function valueLookup(colormap: string) {
  const xml = await getText(`${COLORMAPS}/${colormap}.xml`, { revalidate: 86400 });
  const lookup = new Map<number, number>();
  for (const m of xml.matchAll(/rgb="(\d+),(\d+),(\d+)" transparent="false"[^>]*value="\[([-\w.]+),([-\w.]+)\)"/g)) {
    const lo = parseFloat(m[4]);
    const hi = parseFloat(m[5]);
    const value = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : Number.isFinite(lo) ? lo : hi; // open-ended bands count as their finite end
    lookup.set((+m[1] << 16) | (+m[2] << 8) | +m[3], value);
  }
  return lookup;
}

/** A GIBS picture as raw RGBA pixels, or null when it could not be fetched (tried twice). Not in Next's fetch cache (2 MB limit). */
async function fetchPng(url: string, w: number, h: number): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`GIBS ${res.status}`);
      const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== w || info.height !== h) throw new Error("GIBS: unexpected size");
      return data;
    } catch (e) {
      console.error("[haze] gibs pass:", url, e);
    }
  }
  return null;
}

/** Gaussian blur of two `w` by `h` images at once: wraps around east-west, stops at the poles. */
function blur2(a: Float32Array, b: Float32Array, w: number, h: number) {
  const R = Math.ceil(3 * SIGMA);
  const kernel = Float32Array.from({ length: 2 * R + 1 }, (_, i) => Math.exp(-0.5 * ((i - R) / SIGMA) ** 2));
  const norm = kernel.reduce((s, v) => s + v, 0);
  for (let i = 0; i < kernel.length; i++) kernel[i] /= norm;

  const run = (src: Float32Array) => {
    const rows = new Float32Array(w * h);
    const pad = new Float32Array(w + 2 * R);
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < pad.length; i++) pad[i] = src[y * w + ((i - R + 2 * w) % w)];
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let j = 0; j <= 2 * R; j++) s += kernel[j] * pad[x + j];
        rows[y * w + x] = s;
      }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let j = -R; j <= R; j++) {
        const yy = y + j;
        if (yy < 0 || yy >= h) continue;
        const k = kernel[j + R];
        for (let x = 0; x < w; x++) out[y * w + x] += k * rows[yy * w + x];
      }
    }
    return out;
  };
  return [run(a), run(b)] as const;
}

/** `values` (zero where `have` is 0) smoothed without letting gaps pull it down: the smoothed values and how much data was behind each. */
function smooth(values: Float32Array, have: Float32Array, w: number, h: number) {
  const [v, weight] = blur2(values, have, w, h);
  return { value: v.map((x, i) => (weight[i] > 1e-3 ? x / weight[i] : NaN)), weight };
}

/** Smoothed values at full size (NaN where there is nothing), with gaps wider than the smoothing filled in from a coarser picture if `fill`. */
function smoothFilled(values: Float32Array, have: Float32Array, fill: boolean) {
  const fine = smooth(values, have, W, H);
  if (!fill) return fine.value;
  const cw = W / COARSE;
  const ch = H / COARSE;
  const sum = new Float32Array(cw * ch);
  const n = new Float32Array(cw * ch);
  for (let i = 0; i < W * H; i++) {
    const c = ((i / W / COARSE) | 0) * cw + (((i % W) / COARSE) | 0);
    sum[c] += values[i];
    n[c] += have[i];
  }
  const mean = sum.map((v, c) => (n[c] ? v / n[c] : 0));
  const coarse = smooth(mean, n.map((v) => (v ? 1 : 0)), cw, ch);
  return fine.value.map((v, i) => {
    const c = ((i / W / COARSE) | 0) * cw + (((i % W) / COARSE) | 0);
    const a = Math.min(1, fine.weight[i] / 0.2); // how much of the fine picture to trust
    return Number.isNaN(coarse.value[c]) ? v : Number.isNaN(v) ? coarse.value[c] : a * v + (1 - a) * coarse.value[c];
  });
}

/** The mean of every valid value per pixel over `passes` (raw RGBA pictures of `n` pixels), and which pixels had any. */
function meanValues(passes: Buffer[], lookup: Map<number, number>, n: number) {
  const sum = new Float32Array(n);
  const count = new Float32Array(n);
  for (const px of passes) {
    for (let i = 0; i < n; i++) {
      if (px[i * 4 + 3] === 0) continue;
      const v = lookup.get((px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2]);
      if (v === undefined) continue;
      sum[i] += v;
      count[i]++;
    }
  }
  for (let i = 0; i < n; i++) if (count[i]) sum[i] /= count[i];
  return { mean: sum, have: count.map((c) => (c ? 1 : 0)) };
}

/** `value` (W by H, from 90 N down to 90 S) resampled onto the Web Mercator square of SIZE, MapLibre's placing of an image: NaN where there is nothing. */
function toMercator(value: Float32Array) {
  const out = new Float32Array(SIZE * SIZE);
  const col = Array.from({ length: SIZE }, (_, x) => {
    const f = ((x + 0.5) / SIZE) * W - 0.5;
    const x0 = Math.floor(f);
    return { a: (x0 + W) % W, b: (x0 + 1 + W) % W, t: f - x0 };
  });
  for (let y = 0; y < SIZE; y++) {
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / SIZE))) * 180) / Math.PI;
    const f = ((90 - lat) / 180) * H - 0.5;
    const y0 = Math.floor(f);
    const ty = f - y0;
    const rows = [Math.min(H - 1, Math.max(0, y0)) * W, Math.min(H - 1, Math.max(0, y0 + 1)) * W];
    for (let x = 0; x < SIZE; x++) {
      const { a, b, t } = col[x];
      let sum = 0;
      let weight = 0;
      for (const [v, w] of [[value[rows[0] + a], (1 - ty) * (1 - t)], [value[rows[0] + b], (1 - ty) * t], [value[rows[1] + a], ty * (1 - t)], [value[rows[1] + b], ty * t]]) {
        if (Number.isNaN(v)) continue;
        sum += v * w;
        weight += w;
      }
      out[y * SIZE + x] = weight > 0 ? sum / weight : NaN;
    }
  }
  return out;
}

/** The picture of `layer` for the frame of `date` (YYYY-MM-DD, SGT) as a WebP in Web Mercator, transparent where there is nothing to show, and whether every pass it needs arrived. Throws when no satellite pass could be fetched. */
export async function fetchGlobePicture(layer: GlobeLayer, date: string): Promise<{ webp: Buffer; complete: boolean }> {
  const src = SOURCES[layer];
  const { ramp } = GLOBE_LAYERS[layer];
  const urls = globeDays(layer, date).flatMap((time) => src.layers.map((l) => gibsMap(l, W, H, { format: "png", time })));
  const [lookup, ...passes] = await Promise.all([valueLookup(src.colormap), ...urls.map((u) => fetchPng(u, W, H))]);
  const got = passes.filter((p) => p !== null);
  if (!got.length) throw new Error("GIBS: no passes");

  // Average the passes, smooth, filling gaps from what is around them, then lay the result on the Mercator square.
  const { mean, have } = meanValues(got, lookup, W * H);
  const value = toMercator(smoothFilled(mean, have, src.fill));

  const colours = Array.from({ length: 256 }, (_, i) => rampRgb(ramp, i / 255));
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const t = Number.isNaN(value[i]) ? 0 : rampT(ramp, value[i]);
    rgba.set(colours[Math.round(t * 255)], i * 4);
    rgba[i * 4 + 3] = Number.isNaN(value[i]) ? 0 : ramp.soft ? Math.round(255 * Math.min(1, t / ramp.soft)) : 255;
  }
  const webp = await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .webp({ quality: 80, alphaQuality: 90, smartSubsample: true })
    .toBuffer();
  return { webp, complete: got.length === passes.length };
}

/**
 * The mean reading over the box around Singapore on each of `dates`, by date (null where no pass covered it), and whether
 * every pass arrived. The same averaging as the picture, on pictures of just the box; readings under the layer's floor count as none.
 */
export async function fetchGlobeSeries(layer: GlobeLayer, dates: string[]): Promise<{ values: Record<string, number | null>; complete: boolean }> {
  const src = SOURCES[layer];
  const { digits } = GLOBE_LAYERS[layer].read;
  const days = [...new Set(dates.flatMap((d) => globeDays(layer, d)))];
  const box = [SG.lat - READ_BOX, SG.lon - READ_BOX, SG.lat + READ_BOX, SG.lon + READ_BOX] as const;
  const [lookup, ...fetched] = await Promise.all([
    valueLookup(src.colormap),
    ...days.map((time) => Promise.all(src.layers.map((l) => fetchPng(gibsMap(l, TINY, TINY, { box, format: "png", time }), TINY, TINY)))),
  ]);
  const passes = new Map(days.map((d, i) => [d, fetched[i]]));
  const values = Object.fromEntries(
    dates.map((date) => {
      const { mean, have } = meanValues(globeDays(layer, date).flatMap((d) => passes.get(d)!).filter((p) => p !== null), lookup, TINY * TINY);
      const n = have.reduce((s, h) => s + h, 0);
      const avg = mean.reduce((s, v, i) => s + (have[i] ? (isClear(layer, v) ? 0 : v) : 0), 0) / n;
      return [date, n ? Math.round(avg * 10 ** digits) / 10 ** digits : null];
    }),
  );
  return { values, complete: fetched.every((day) => day.every((p) => p !== null)) };
}
