import type { Fire } from "../types";

// Pure parts of the NASA FIRMS VIIRS reader, apart from firms.ts so that browser code (the history builder) can use them
// without pulling in Next's server cache.

export type Area = "sumatra" | "borneo" | "peninsula";

export const AREAS: Area[] = ["sumatra", "borneo", "peninsula"];

/** Compact fire: lat, lon, frp, epoch ms, index in AREAS, confidence. */
export type Row = [number, number, number, number, number, string];

export function classify(lat: number, lon: number): Area | null {
  if (lon >= 108.5 && lon <= 119.5 && lat >= -4.5 && lat <= 7.5) return "borneo";
  const peninsula = lon > 99.6 && lon < 105 && lat < 7 && lat > 4.5 - 0.854 * (lon - 99.5);
  if (peninsula) return "peninsula";
  if (lon >= 95 && lon <= 106.5 && lat >= -6.2 && lat <= 6) return "sumatra";
  return null;
}

/** The FIRMS area-API CSV as compact rows, except low-confidence fires and those outside the three areas. Throws on a response that is not a FIRMS table. */
export function parseFirmsCsv(csv: string): Row[] {
  const lines = csv.trim().split("\n");
  const head = lines[0].split(",");
  const iLat = head.indexOf("latitude");
  const iLon = head.indexOf("longitude");
  const iFrp = head.indexOf("frp");
  const iConf = head.indexOf("confidence");
  const iDate = head.indexOf("acq_date");
  const iTime = head.indexOf("acq_time");
  if (iLat < 0 || iLon < 0) throw new Error(`FIRMS: unexpected response`);
  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const conf = c[iConf] ?? "";
    if (conf === "l" || conf === "low") continue;
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    const where = classify(lat, lon);
    if (!where) continue;
    const t = (c[iTime] ?? "0000").padStart(4, "0");
    rows.push([lat, lon, parseFloat(c[iFrp]) || 0, Date.parse(`${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`), AREAS.indexOf(where), conf]);
  }
  return rows;
}

/** A compact row as a fire, with the area it is in. */
export const rowToFire = ([lat, lon, frp, t, a, confidence]: Row): Fire & { where: Area } => ({
  lat,
  lon,
  frp,
  confidence,
  where: AREAS[a],
  time: new Date(t).toISOString().slice(0, 19) + "Z",
});
