// The shape of the air globe's daily history files and what the browser needs of them. The builder is in history.ts (server and script only).
import type { PollutantId } from "./pollutants";

/**
 * One SGT day (00:00 to 24:00 SGT, which is 16:00 UTC the day before to 16:00 UTC), as frames 3 hours apart at 00, 03, ... 21 SGT.
 * Grids are row-major by latitude, [frame][lat * lons.length + lon], on the 1° regional grid (`lats`, `lons`).
 */
export type HistoryDay = {
  date: string;
  /** The strongest fires acquired in the day (up to 1500, fewer if the file would pass 100 KB), strongest first: lat, lon (2 decimals), FRP in MW (integer). */
  fires: [lat: number, lon: number, frp: number][];
  /** All fires of the day by area, not just those listed. */
  totals: Record<"sumatra" | "borneo" | "peninsula", number>;
  /** ISO times (UTC) of the frames. */
  times: string[];
  lats: number[];
  lons: number[];
  /** 850 hPa wind in m/s to 1 decimal: u towards the east, v towards the north. */
  wind: { u: number[][]; v: number[][] };
  /** CAMS surface concentrations in µg/m³ (integers) for each pollutant that has data. */
  gases: Partial<Record<PollutantId, number[][]>>;
  /** The air that reached Singapore at 2 pm SGT, 72 hours of back-trail, one point an hour, newest first. */
  trail: [number, number][];
  /** NEA's highest 24-hr PSI and highest 1-hour PM2.5 of the day; null when NEA has none. */
  nea: { psiMax: number | null; pm25Max: number | null };
};

/** What the timeline bars need: per day the fires (Sumatra and Borneo, as the live replay counts) and Singapore's highest PSI. */
export type HistoryIndex = { updated: string; days: { date: string; fires: number; psiMax: number | null }[] };

/** The newest day (the list is oldest first) with at least `min` fires: a day with only a few is a partial or a failed pass, not a picture of the fires. */
export function latestFireDay<T extends { fires: unknown[] }>(days: T[], min = 20): T | undefined {
  return days.findLast((d) => d.fires.length >= min);
}
