import { unstable_cache } from "next/cache";
import { GLOBE_LAYERS, globeDays, isSettled, rampRgb, rampT, type GlobeLayer } from "../globe";
import { gibsMap } from "../satellite";
import { getText } from "../util";
import { createImageCodec } from "./imageCodec";

// Pollution pictures for the map, built from NASA GIBS satellite passes. GIBS only serves each pass as a coloured
// picture, so the colours are turned back into values, the passes averaged and smoothed, and the result coloured
// again with our own ramp. Also each day's mean over Singapore, from tiny pictures of just that box. Each finished answer
// is kept in Next's data cache (so a rebuild from GIBS takes seconds and happens once, not per request) and by the CDN.

type Source = {
  layers: string[]; // one picture per layer and day
  colormap: string;
};

const COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3";
const SOURCES: Record<GlobeLayer, Source> = {
  smoke: {
    layers: ["OMPS_NOAA20_NadirMapper_AerosolIndex_380", "OMPS_NOAA21_NadirMapper_AerosolIndex_380"],
    colormap: "OMPS_Aerosol_Index",
  },
};

const W = 1440; // the size of every pass: 0.25 degrees a pixel, about the sharpness of the instruments
const H = 720;
const SIZE = 2048; // the finished picture is this many pixels square, in Web Mercator: smooth and about 100 KB as WebP when zoomed to a city
const SIGMA = 5; // pixels of smoothing, about 1.25 degrees

const codec = createImageCodec(async () => (await import("./codecWasm")).default);

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
async function fetchPng(url: string, w: number, h: number): Promise<Uint8ClampedArray | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`GIBS ${res.status}`);
      const { data, width, height } = await codec.decodePng(await res.arrayBuffer());
      if (width !== w || height !== h) throw new Error("GIBS: unexpected size");
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

/** The mean of every valid value per pixel over `passes` (raw RGBA pictures of `n` pixels), and which pixels had any. */
function meanValues(passes: Uint8ClampedArray[], lookup: Map<number, number>, n: number) {
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

/** Thrown inside a cached build to keep an incomplete answer out of the cache: it carries the answer for the caller. */
class Incomplete<T> extends Error {
  constructor(readonly answer: T) {
    super("incomplete");
  }
}

/** `build` kept in the data cache for `revalidate` seconds under `name`, except an incomplete answer, which is returned but never kept. Answers must be JSON. */
function cachedWhole<A extends unknown[], T extends { complete: boolean }>(name: string, revalidate: number, build: (...args: A) => Promise<T>) {
  const cached = unstable_cache(
    async (...args: A) => {
      const answer = await build(...args);
      if (!answer.complete) throw new Incomplete(answer);
      return answer;
    },
    [name],
    { revalidate },
  );
  return (...args: A): Promise<T> =>
    cached(...args).catch((e) => {
      if (e instanceof Incomplete) return e.answer as T;
      throw e;
    });
}

/** The WebP of `layer` for the frame of `date` as base64 (the data cache holds JSON), and whether every pass it needs arrived. Throws when no satellite pass could be fetched. */
async function buildPicture(layer: GlobeLayer, date: string): Promise<{ webp: string; complete: boolean }> {
  const src = SOURCES[layer];
  const { ramp } = GLOBE_LAYERS[layer];
  const urls = globeDays(layer, date).flatMap((time) => src.layers.map((l) => gibsMap(l, W, H, { format: "png", time })));
  const [lookup, ...passes] = await Promise.all([valueLookup(src.colormap), ...urls.map((u) => fetchPng(u, W, H))]);
  const got = passes.filter((p) => p !== null);
  if (!got.length) throw new Error("GIBS: no passes");

  // Average the passes, smooth, then lay the result on the Mercator square.
  const { mean, have } = meanValues(got, lookup, W * H);
  const value = toMercator(smooth(mean, have, W, H).value);

  const colours = Array.from({ length: 256 }, (_, i) => rampRgb(ramp, i / 255));
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const t = Number.isNaN(value[i]) ? 0 : rampT(ramp, value[i]);
    rgba.set(colours[Math.round(t * 255)], i * 4);
    rgba[i * 4 + 3] = Number.isNaN(value[i]) ? 0 : ramp.soft ? Math.round(255 * Math.min(1, t / ramp.soft)) : 255;
  }
  const webp = await codec.encodeWebp({ data: rgba, width: SIZE, height: SIZE });
  return { webp: Buffer.from(webp).toString("base64"), complete: got.length === passes.length };
}

const SETTLED_S = 7 * 86400; // a day older than 2 days will not change
const RECENT_S = 6 * 3600; // NASA adds a day's passes once a day
const settledPicture = cachedWhole("globe-picture-settled", SETTLED_S, buildPicture);
const recentPicture = cachedWhole("globe-picture-recent", RECENT_S, buildPicture);

/** The picture of `layer` for the frame of `date` (YYYY-MM-DD, SGT) as a WebP in Web Mercator, transparent where there is nothing to show, and whether every pass it needs arrived. Kept in the data cache once complete. Throws when no satellite pass could be fetched. */
export async function fetchGlobePicture(layer: GlobeLayer, date: string): Promise<{ webp: Buffer; complete: boolean }> {
  const { webp, complete } = await (isSettled(date) ? settledPicture : recentPicture)(layer, date);
  return { webp: Buffer.from(webp, "base64"), complete };
}
