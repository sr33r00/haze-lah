import type { Map as MapLibre, PaddingOptions } from "maplibre-gl";

/** Where the camera looks from: a point on the Earth and a zoom. */
export type Pose = { lng: number; lat: number; zoom: number };
/** Where the flight ends: the pose, with the tilt and padding it settles on. */
export type Landing = Pose & { pitch: number; padding: Required<PaddingOptions> };
/** One stretch of the flight: `ms` long, moving along `ease` to `to`. */
type Leg = { ms: number; to: Pose; ease: (t: number) => number };
/** A tile of NASA's 256 px pyramid. */
export type Tile = { z: number; x: number; y: number };

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The first visit opens on the whole Earth with Asia rising on the right; a return visit starts closer, over the region. */
const START = { first: { lng: 60, lat: 10, zoom: 0.9 }, back: { lng: 104, lat: 2, zoom: 1.5 } };
const DRIFT: Pose = { lng: 95, lat: 6, zoom: 1.7 };
/** The tilt, which shows the horizon, waits until this share of the last leg has passed: by then the tiles near the landing are loading. */
const TILT_AT = 0.45;

/** Where the camera starts. */
export const startPose = (first: boolean) => (first ? START.first : START.back);

/** The first visit drifts east and then descends slowly, so that each level of tiles arrives in time; a return visit goes straight in. */
export function flightLegs(first: boolean, landing: Pose): Leg[] {
  return first
    ? [{ ms: 2600, to: DRIFT, ease: easeInOut }, { ms: 3400, to: landing, ease: easeOut }]
    : [{ ms: 2400, to: landing, ease: easeInOut }];
}

/** The camera `ms` into the flight, and how far the tilt has come (0 to 1). Longitude, latitude and zoom move in a straight line per leg (zoom is already logarithmic). */
export function poseAt(start: Pose, legs: Leg[], ms: number) {
  let i = 0;
  let from = start;
  while (i < legs.length - 1 && ms >= legs[i].ms) {
    ms -= legs[i].ms;
    from = legs[i].to;
    i++;
  }
  const { ms: span, to, ease } = legs[i];
  const t = Math.min(ms / span, 1);
  const e = ease(t);
  const pose: Pose = { lng: from.lng + (to.lng - from.lng) * e, lat: from.lat + (to.lat - from.lat) * e, zoom: from.zoom + (to.zoom - from.zoom) * e };
  const tilt = i === legs.length - 1 ? easeInOut(Math.max(0, (t - TILT_AT) / (1 - TILT_AT))) : 0;
  return { pose, tilt };
}

const SKIP = ["pointerdown", "wheel", "touchstart", "keydown"] as const;

/**
 * Flies `m` from `start` along `legs` to `landing`, one jumpTo per frame. A touch, wheel or key press skips to the landing.
 * `done` runs when the flight ends or is skipped; the returned function stops it for good (and `done` does not run).
 */
export function fly(m: MapLibre, start: Pose, legs: Leg[], landing: Landing, done: () => void) {
  const total = legs.reduce((sum, leg) => sum + leg.ms, 0);
  const t0 = performance.now();
  let frame = 0;
  const show = (ms: number) => {
    const { pose, tilt } = poseAt(start, legs, ms);
    const { top, bottom, left, right } = landing.padding;
    // The padding comes in with the tilt, so that the view does not jump where the card's room is kept at the end.
    m.jumpTo({ center: [pose.lng, pose.lat], zoom: pose.zoom, pitch: landing.pitch * tilt, padding: { top: top * tilt, bottom: bottom * tilt, left: left * tilt, right: right * tilt } });
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of SKIP) removeEventListener(type, finish, { capture: true });
  };
  const finish = () => {
    stop();
    show(total);
    done();
  };
  const tick = () => {
    const ms = performance.now() - t0;
    if (ms >= total) return finish();
    show(ms);
    frame = requestAnimationFrame(tick);
  };
  for (const type of SKIP) addEventListener(type, finish, { capture: true, passive: true });
  frame = requestAnimationFrame(tick);
  return stop;
}

/**
 * The tiles a screen of `w` by `h` px shows around `center` at `zoom` seen from straight above, nearest first and at most `cap`: the
 * heart of the view. A tilted view shows more towards the horizon, but at coarser levels, which MapLibre asks for itself.
 * MapLibre rounds a raster's level (its 256 px tiles sit one level above the map's zoom); `maxZoom` is the finest level there is.
 */
export function tilesAround(center: { lng: number; lat: number }, zoom: number, w: number, h: number, maxZoom: number, cap = 24): Tile[] {
  const z = Math.max(0, Math.min(maxZoom, Math.round(zoom + 1)));
  const n = 2 ** z;
  const lat = (center.lat * Math.PI) / 180;
  const cx = ((center.lng + 180) / 360) * n;
  const cy = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n; // Web Mercator
  const scale = 2 ** (z - zoom - 1) / 256; // tiles per screen px
  const hx = (w / 2) * scale;
  const hy = (h / 2) * scale;
  const found = new Map<string, Tile & { d: number }>();
  for (let y = Math.max(0, Math.floor(cy - hy)); y <= Math.min(n - 1, Math.floor(cy + hy)); y++) {
    for (let x = Math.floor(cx - hx); x <= Math.floor(cx + hx); x++) {
      const wrapped = ((x % n) + n) % n;
      found.set(`${wrapped}/${y}`, { z, x: wrapped, y, d: Math.hypot(x + 0.5 - cx, y + 0.5 - cy) });
    }
  }
  return [...found.values()].sort((a, b) => a.d - b.d).slice(0, cap).map(({ z, x, y }) => ({ z, x, y }));
}
