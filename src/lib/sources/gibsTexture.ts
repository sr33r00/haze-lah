import sharp from "sharp";
import { GLOBE_LAYERS, globeDays, rampRgb, type GlobeLayer } from "../globe";
import { COAST, gibsMap } from "../satellite";
import { getText } from "../util";

// Equirectangular pollution textures for the globe, built from NASA GIBS satellite passes. GIBS only serves each
// pass as a coloured picture, so the colours are turned back into values, the passes averaged and smoothed, and
// the result coloured again with our own ramp. The route that serves it is cached by the CDN for 6 hours.

type Source = {
  layers: string[]; // one picture per layer and day
  colormap: string;
  coast: [number, number, number]; // colour of the coastlines drawn on top
  fill: boolean; // paint wide gaps between passes with the values around them; otherwise gaps read as "none"
};

const COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3";
const SOURCES: Record<GlobeLayer, Source> = {
  co: {
    layers: ["AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day", "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Night"],
    colormap: "AIRS_Carbon_Monoxide_Volume_Mixing_Ratio",
    coast: [15, 15, 15],
    fill: true,
  },
  smoke: {
    layers: ["OMPS_NOAA20_NadirMapper_AerosolIndex_380", "OMPS_NOAA21_NadirMapper_AerosolIndex_380"],
    colormap: "OMPS_Aerosol_Index",
    coast: [150, 165, 190],
    fill: false,
  },
};

const W = 1440; // working size; the result is scaled up to the texture size
const H = 720;
const OUT_W = 2048;
const OUT_H = 1024;
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

/** A GIBS picture as raw RGBA pixels, or null when this pass is missing. Not in Next's fetch cache (2 MB limit). */
async function fetchPng(url: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`GIBS ${res.status}`);
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== w || info.height !== h) throw new Error("GIBS: unexpected size");
    return data;
  } catch (e) {
    console.error("[haze] gibs pass:", url, e);
    return null;
  }
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

/** The globe texture of `layer` as a JPEG. Throws when no satellite pass could be fetched. */
export async function fetchGlobeTexture(layer: GlobeLayer, now = Date.now()): Promise<Buffer> {
  const src = SOURCES[layer];
  const ramp = GLOBE_LAYERS[layer].ramp;
  const urls = globeDays(layer, now).flatMap((time) => src.layers.map((l) => gibsMap(l, W, H, { format: "png", time })));
  const [lookup, coast, ...passes] = await Promise.all([
    valueLookup(src.colormap),
    fetchPng(gibsMap(COAST, OUT_W, OUT_H, { format: "png" }), OUT_W, OUT_H),
    ...urls.map((u) => fetchPng(u, W, H)),
  ]);
  const got = passes.filter((p) => p !== null);
  if (!got.length) throw new Error("GIBS: no passes");

  // Average every valid value per pixel.
  const sum = new Float32Array(W * H);
  const count = new Float32Array(W * H);
  for (const px of got) {
    for (let i = 0; i < W * H; i++) {
      if (px[i * 4 + 3] === 0) continue;
      const v = lookup.get((px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2]);
      if (v === undefined) continue;
      sum[i] += v;
      count[i]++;
    }
  }
  const have = count.map((c) => (c ? 1 : 0));
  for (let i = 0; i < W * H; i++) if (count[i]) sum[i] /= count[i];

  // Smooth, filling gaps from what is around them.
  const value = smoothFilled(sum, have, src.fill);
  const [lo, hi] = ramp.range;
  const colours = Array.from({ length: 256 }, (_, i) => rampRgb(ramp, i / 255));
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const t = Number.isNaN(value[i]) ? 0 : Math.min(1, Math.max(0, (value[i] - lo) / (hi - lo)));
    rgb.set(colours[Math.round(t * 255)], i * 3);
  }

  // Coastlines in one flat colour, over the scaled-up picture. GIBS also draws a line along the bottom edge of Antarctica; drop it.
  if (coast) {
    for (let y = 0; y < OUT_H; y++) {
      const row = y * OUT_W * 4;
      let ink = 0;
      for (let x = 0; x < OUT_W; x++) if (coast[row + x * 4 + 3]) ink++;
      for (let x = 0; x < OUT_W; x++) {
        if (ink === OUT_W) coast[row + x * 4 + 3] = 0;
        else coast.set(src.coast, row + x * 4);
      }
    }
  }
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .resize(OUT_W, OUT_H, { kernel: "cubic" })
    .composite(coast ? [{ input: coast, raw: { width: OUT_W, height: OUT_H, channels: 4 } }] : [])
    .jpeg({ quality: 82 })
    .toBuffer();
}
