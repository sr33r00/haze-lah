/** A scalar field on a regular lat/lon grid, row-major by latitude. */
export type Field = { lats: number[]; lons: number[]; data: number[] };

/** Bilinear sample at a point; null outside the grid. */
export function sample(f: Field, lat: number, lon: number): number | null {
  const { lats, lons, data } = f;
  const la0 = lats[0];
  const lo0 = lons[0];
  const y = (lat - la0) / (lats[1] - la0);
  const x = (lon - lo0) / (lons[1] - lo0);
  if (y < 0 || x < 0 || y > lats.length - 1 || x > lons.length - 1) return null;
  const i = Math.min(lats.length - 2, Math.floor(y));
  const j = Math.min(lons.length - 2, Math.floor(x));
  const fy = y - i;
  const fx = x - j;
  const w = lons.length;
  const top = data[i * w + j] * (1 - fx) + data[i * w + j + 1] * fx;
  const bot = data[(i + 1) * w + j] * (1 - fx) + data[(i + 1) * w + j + 1] * fx;
  return top * (1 - fy) + bot * fy;
}

/** Wind (m/s) on one grid at time `t` (ms); u is towards the east, v towards the north. */
export type WindFrame = { t: number; u: Field; v: Field };

const M_PER_DEG = 111_320;

/** Wind at a place and time, linear in time between the two nearest frames (frames sorted by time). */
function windAt(frames: WindFrame[], lat: number, lon: number, t: number): [number, number] | null {
  const k = Math.max(0, frames.findLastIndex((f) => f.t <= t));
  const a = frames[k];
  const b = frames[Math.min(k + 1, frames.length - 1)];
  const w = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const ua = sample(a.u, lat, lon);
  const va = sample(a.v, lat, lon);
  const ub = sample(b.u, lat, lon);
  const vb = sample(b.v, lat, lon);
  if (ua == null || va == null || ub == null || vb == null) return null;
  return [ua + (ub - ua) * w, va + (vb - va) * w];
}

/**
 * Where the air arriving at a point at `arrival` came from: steps back in time along the wind (midpoint method),
 * one point per hour, newest first. Stops early if the path leaves the grid.
 */
export function backTrail(frames: WindFrame[], lat: number, lon: number, arrival: number, hours = 72): [number, number][] {
  const H = 3600;
  const step = (la: number, lo: number, u: number, v: number, s: number): [number, number] => [
    la - (v * s) / M_PER_DEG,
    lo - (u * s) / (M_PER_DEG * Math.cos((la * Math.PI) / 180)),
  ];
  const path: [number, number][] = [[lat, lon]];
  for (let h = 0; h < hours; h++) {
    const t = arrival - h * H * 1000;
    const w1 = windAt(frames, lat, lon, t);
    if (!w1) break;
    const [mLat, mLon] = step(lat, lon, w1[0], w1[1], H / 2);
    const w2 = windAt(frames, mLat, mLon, t - (H / 2) * 1000);
    if (!w2) break;
    [lat, lon] = step(lat, lon, w2[0], w2[1], H);
    path.push([Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]);
  }
  return path;
}
