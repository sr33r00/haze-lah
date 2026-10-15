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
