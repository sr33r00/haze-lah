import type { HourPoint } from "./types";
import { sgDate } from "./util";

/**
 * PM2.5 (µg/m³, 24-hour mean) that carries about the same mortality risk as one cigarette a day.
 * Muller & Muller (2015), Berkeley Earth, "Air Pollution and Cigarette Equivalence";
 * built on exposure-response curves such as Pope et al. (2011), https://doi.org/10.1289/ehp.1103639
 */
export const PM25_PER_CIGARETTE = 22;

export const CIGARETTE_SOURCES = [
  ["Berkeley Earth, 2015", "https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/"],
  ["Pope et al., 2011", "https://doi.org/10.1289/ehp.1103639"],
] as const;

export const CIGARETTE_NOTES = [
  "Breathing PM2.5 at 22 µg/m³ for 24 hours carries about the same risk of early death as smoking one cigarette. It compares health risk, not the smoke you inhale.",
  "So far today adds up each hour's reading since midnight.",
  "It is a long-term average, a rough illustration and not a literal dose. Haze smoke and tobacco smoke are different.",
  "Staying indoors with windows closed and a HEPA air purifier lowers what you actually breathe.",
];

/** Cigarettes per day for a 24-hour PM2.5: 1 decimal below 1, else whole. Null if unusable. */
export function cigarettes(pm25_24h: number): number | null {
  if (!Number.isFinite(pm25_24h)) return null;
  const n = Math.max(0, pm25_24h) / PM25_PER_CIGARETTE;
  return n < 1 ? Math.round(n * 10) / 10 : Math.round(n);
}

/** Cigarettes so far today: hourly readings since 00:00 SGT summed, over 24 hours. Null before 1am or with no readings. */
export function cigarettesSoFar(points: HourPoint[] | undefined, now = new Date()): number | null {
  const today = sgDate(0, now);
  const mine = (points ?? []).filter((p) => sgDate(0, new Date(p.time)) === today && Number.isFinite(p.value));
  if (!mine.length || (now.getTime() + 8 * 3600_000) % 86400_000 < 3600_000) return null;
  return cigarettes(mine.reduce((a, p) => a + p.value, 0) / 24);
}
