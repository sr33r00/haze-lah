import { sample, type Field } from "@/lib/wind";

const PX_PER_PARTICLE = 900; // screen area per particle, so big maps are as dense as small ones
const MIN_COUNT = 400;
const MAX_COUNT = 1500; // a big monitor gets this many, not more: the work per frame grows with the count (about 4 times a phone's)
const MAX_BACKING = 4_000_000; // pixels the canvas may have in memory; the rest of a big, sharp screen is not worth the fill and composite of every frame (1920 x 1080 at 2x would have 8.3 million)
const MAX_AGE = 80; // steps
const STEP_MS = 16; // one step per ~60 Hz frame, so 120 and 144 Hz screens move and fade at the same speed
const PX_PER_MS = 0.012; // screen speed per m/s of wind
const FULL_SHARE = 0.25; // a grid that covers at least this share of the screen gets the full count; a smaller one gets proportionally fewer
const MIN_SHARE_COUNT = 30; // fewest particles, however small the grid looks
const FEATHER = 2; // degrees: lines fade out over this distance to the grid's edge, so the edge does not show as a box
const LEVELS = 5; // steps of that fade; the lines of one step are drawn together
const ARROW_STEP = 2; // degrees between static arrows, doubled while they would be closer than ARROW_GAP
const ARROW_GAP = 20; // pixels
const SEED_TRIES = 6; // looks for a spot that is on screen, for maps where part of the grid is hidden

/** How many particles a map of `w` x `h` CSS pixels gets before the share of it that the grid covers is taken into account. */
export const particleCount = (w: number, h: number) => Math.round(Math.min(MAX_COUNT, Math.max(MIN_COUNT, (w * h) / PX_PER_PARTICLE)));

/** The canvas pixels per CSS pixel for a map of `w` x `h` at device ratio `dpr`: the screen's (up to 2), less where that would pass MAX_BACKING pixels, never under 1. */
export const canvasRatio = (w: number, h: number, dpr: number) => Math.max(1, Math.min(2, dpr, Math.sqrt(MAX_BACKING / Math.max(1, w * h))));

/** Wind (m/s) on a lat/lon grid: u towards the east, v towards the north. */
export type Wind = { u: Field; v: Field };

/** The wind on a grid given as flat arrays, row-major by latitude. */
export const windOf = (lats: number[], lons: number[], u: number[], v: number[]): Wind => ({ u: { lats, lons, data: u }, v: { lats, lons, data: v } });

/**
 * What the wind animation needs from a map: where a place is on screen, how big the screen is and when the view moves.
 * Leaflet's map and MapLibre's globe each implement it; the animation itself is the same.
 */
export type WindView = {
  /** The element the animation's canvas is placed in (it fills it). */
  container: HTMLElement;
  /** Stacking order of the canvas among the map's own layers and controls. */
  zIndex: number;
  /** Size of the container in CSS pixels. */
  size(): { w: number; h: number };
  /** Screen position of a place, or null when it is not visible (for example the far side of a globe). */
  project(lat: number, lon: number): { x: number; y: number } | null;
  /** What is roughly on screen, as [south, west, north, east]: places outside it are not seeded. */
  bounds(): [number, number, number, number];
  /** Screen pixels per degree of longitude near the middle of the view. */
  pxPerDeg(): number;
  /** Calls `moved` as the view moves or zooms, `settled` when it stops, `resized` when the container changes size. Returns the way to stop. */
  listen(on: { moved(): void; settled(): void; resized(): void }): () => void;
};

export type WindParticles = {
  /** The wind to draw; undefined draws nothing. */
  setWind(wind: Wind | undefined): void;
  /** True draws the animation even where the viewer asked for reduced motion. */
  setMotion(motion: boolean): void;
  destroy(): void;
};

type Particle = { lat: number; lon: number; pLat: number; pLon: number; age: number };

/**
 * Animated wind particles on a canvas over a map: fading trails that follow the wind, as many as the screen's area calls for,
 * one animation frame loop that stops while the tab is hidden or the map is off screen. Under reduced motion it draws still
 * arrows instead, unless the motion was asked for. `ink` is the line colour; by default the page's text colour, so it follows the theme.
 */
export function windParticles(view: WindView, ink?: string): WindParticles {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${view.zIndex}`;
  view.container.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const parts: Particle[] = [];
  let wind: Wind | undefined;
  let motion = false;
  let colour = ink ?? "#000";
  let raf = 0;
  let last = 0;
  let n = 0;
  let onScreen = true;
  const seg = new Float32Array(MAX_COUNT * 4); // this frame's line of each particle: x0, y0, x1, y1
  const level = new Uint8Array(MAX_COUNT); // its fade step, 0 for none

  const size = () => {
    const { w, h } = view.size();
    const ratio = canvasRatio(w, h, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  const readInk = () => {
    if (!ink) colour = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#000";
  };

  /** The part of the grid that may be on screen, as [south, west, north, east]. */
  const area = () => {
    const [s, w, nn, e] = view.bounds();
    const { lats, lons } = wind!.u;
    return [Math.max(s, lats[0]), Math.max(w, lons[0]), Math.min(nn, lats.at(-1)!), Math.min(e, lons.at(-1)!)];
  };
  /** Screen position of a place, or null when it is hidden or outside the canvas. */
  const shown = (lat: number, lon: number) => {
    const pt = view.project(lat, lon);
    if (!pt) return null;
    const { w, h } = view.size();
    return pt.x >= 0 && pt.y >= 0 && pt.x <= w && pt.y <= h ? pt : null;
  };
  /** 0 at the grid's edge to 1 from FEATHER degrees inside it, smoothly. */
  const feather = (lat: number, lon: number) => {
    const { lats, lons } = wind!.u;
    const d = Math.min(lat - lats[0], lats[lats.length - 1] - lat, lon - lons[0], lons[lons.length - 1] - lon) / FEATHER;
    return d >= 1 ? 1 : d <= 0 ? 0 : d * d * (3 - 2 * d);
  };
  const velocity = (lat: number, lon: number) => {
    const u = sample(wind!.u, lat, lon);
    const v = sample(wind!.v, lat, lon);
    return u == null || v == null ? null : ([u, v] as const);
  };
  const seed = (p: Particle) => {
    const [s, w, nn, e] = area();
    for (let i = 0; i < SEED_TRIES; i++) {
      p.lat = s + Math.random() * (nn - s);
      p.lon = w + Math.random() * (e - w);
      if (shown(p.lat, p.lon)) break;
    }
    p.pLat = p.lat;
    p.pLon = p.lon;
    p.age = Math.floor(Math.random() * MAX_AGE);
  };

  const frameStep = (t: number) => {
    raf = requestAnimationFrame(frameStep);
    if (t - last < STEP_MS) return;
    const dt = Math.min(50, t - last);
    last = t;
    if (n++ % 60 === 0) readInk();
    // Fade old trails, then extend each particle along the wind.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    const ppd = view.pxPerDeg();
    parts.forEach((p, i) => {
      level[i] = 0;
      const vel = p.age++ < MAX_AGE ? velocity(p.lat, p.lon) : null;
      if (!vel) return seed(p);
      p.pLat = p.lat;
      p.pLon = p.lon;
      p.lon += (vel[0] * PX_PER_MS * dt) / ppd;
      p.lat += (vel[1] * PX_PER_MS * dt * Math.cos((p.lat * Math.PI) / 180)) / ppd;
      const a = view.project(p.pLat, p.pLon);
      const b = view.project(p.lat, p.lon);
      const fade = feather(p.lat, p.lon);
      if (!a || !b || fade === 0) return; // a place on the far side of a globe is not drawn
      seg[i * 4] = a.x;
      seg[i * 4 + 1] = a.y;
      seg[i * 4 + 2] = b.x;
      seg[i * 4 + 3] = b.y;
      level[i] = Math.min(LEVELS, Math.ceil(fade * LEVELS));
    });
    for (let k = 1; k <= LEVELS; k++) {
      ctx.globalAlpha = (0.5 * k) / LEVELS;
      ctx.beginPath();
      for (let i = 0; i < parts.length; i++) {
        if (level[i] !== k) continue;
        ctx.moveTo(seg[i * 4], seg[i * 4 + 1]);
        ctx.lineTo(seg[i * 4 + 2], seg[i * 4 + 3]);
      }
      ctx.stroke();
    }
  };

  const arrows = () => {
    clear();
    readInk();
    const [s, w, nn, e] = area();
    let step = ARROW_STEP;
    while (step * view.pxPerDeg() < ARROW_GAP) step *= 2;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (let la = Math.ceil(s / step) * step; la <= nn; la += step) {
      for (let lo = Math.ceil(w / step) * step; lo <= e; lo += step) {
        const vel = velocity(la, lo);
        if (!vel) continue;
        const sp = Math.hypot(vel[0], vel[1]);
        if (sp < 0.3) continue;
        const c = shown(la, lo);
        const fade = feather(la, lo);
        if (!c || fade === 0) continue;
        const len = Math.min(26, 6 + sp * 2.5);
        const dx = (vel[0] / sp) * len;
        const dy = (-vel[1] / sp) * len;
        const tx = c.x + dx / 2;
        const ty = c.y + dy / 2;
        const hx = (vel[0] / sp) * 4;
        const hy = (-vel[1] / sp) * 4;
        ctx.globalAlpha = 0.6 * fade;
        ctx.beginPath();
        ctx.moveTo(c.x - dx / 2, c.y - dy / 2);
        ctx.lineTo(tx, ty);
        ctx.moveTo(tx - hx - hy * 0.6, ty - hy + hx * 0.6);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx - hx + hy * 0.6, ty - hy - hx * 0.6);
        ctx.stroke();
      }
    }
  };

  const still = () => reduced.matches && !motion;
  /** Share of the screen that the wind's grid covers, from where the corners of its visible part land. 1 when that cannot be told. */
  const share = () => {
    const [s, w, nn, e] = area();
    const { w: sw, h: sh } = view.size();
    const pts = [view.project(s, w), view.project(s, e), view.project(nn, w), view.project(nn, e)];
    if (pts.some((pt) => !pt)) return 1;
    const xs = pts.map((pt) => pt!.x);
    const ys = pts.map((pt) => pt!.y);
    const span = (lo: number[], max: number) => Math.max(0, Math.min(max, Math.max(...lo)) - Math.max(0, Math.min(...lo)));
    return (span(xs, sw) * span(ys, sh)) / (sw * sh);
  };
  /** Particle count for the map's size, fewer where the grid covers only a part of it. */
  const fit = () => {
    const { w, h } = view.size();
    const full = particleCount(w, h);
    const want = Math.max(MIN_SHARE_COUNT, Math.round(full * Math.min(1, share() / FULL_SHARE)));
    while (parts.length < want) {
      const p = { lat: 0, lon: 0, pLat: 0, pLon: 0, age: 0 };
      seed(p);
      parts.push(p);
    }
    parts.length = want;
  };

  let redraw = () => {};
  const start = () => {
    cancelAnimationFrame(raf);
    clear();
    redraw = () => {};
    if (!wind) return;
    if (still()) {
      redraw = arrows;
      arrows();
      return;
    }
    fit();
    readInk();
    if (document.visibilityState === "visible" && onScreen) {
      last = performance.now();
      raf = requestAnimationFrame(frameStep);
    }
  };
  // Trails are drawn in screen space, so wipe them whenever the view moves.
  const moved = () => {
    clear();
    if (!wind) return;
    if (still()) arrows();
    else
      for (const p of parts) {
        p.pLat = p.lat;
        p.pLon = p.lon;
      }
  };
  // After a pan or zoom, particles that are now off screen are re-seeded in view.
  const settled = () => {
    if (!wind || still()) return;
    const [s, w, nn, e] = area();
    for (const p of parts) if (p.lat < s || p.lat > nn || p.lon < w || p.lon > e || !shown(p.lat, p.lon)) seed(p);
    fit();
  };
  const resized = () => {
    size();
    if (wind && !still()) fit();
    moved();
  };

  // Nothing runs while the map is scrolled out of view.
  const seen = new IntersectionObserver(([e]) => {
    if (e.isIntersecting === onScreen) return;
    onScreen = e.isIntersecting;
    start();
  });
  seen.observe(canvas);
  size();
  const stop = view.listen({ moved, settled, resized });
  document.addEventListener("visibilitychange", start);
  reduced.addEventListener("change", start);

  return {
    setWind(next) {
      const had = !!wind;
      wind = next;
      if (had === !!next) redraw();
      else start();
    },
    setMotion(next) {
      if (motion === next) return;
      motion = next;
      start();
    },
    destroy() {
      cancelAnimationFrame(raf);
      seen.disconnect();
      stop();
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
      canvas.remove();
    },
  };
}
