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
  "Right now is this hour's PM2.5 as if you breathed it for a whole day, so it drops as soon as the air clears.",
  "So far today adds up each hour's reading since midnight; the icons burn down as the day goes on.",
  "It is a long-term average, a rough illustration and not a literal dose. Haze smoke and tobacco smoke are different.",
  "Staying indoors with windows closed and a HEPA air purifier lowers what you actually breathe.",
];

/** Cigarettes a day for a PM2.5 (µg/m³) breathed for 24 hours: 1 decimal below 1, else whole. Null if unusable. */
export function cigarettes(pm25: number): number | null {
  if (!Number.isFinite(pm25)) return null;
  const n = Math.max(0, pm25) / PM25_PER_CIGARETTE;
  return n < 1 ? Math.round(n * 10) / 10 : Math.round(n);
}

/** Today's hourly PM2.5 readings (µg/m³) since 00:00 SGT. Null before 1am or with no readings. */
export function readingsToday(points: HourPoint[] | undefined, now = new Date()): number[] | null {
  const today = sgDate(0, now);
  const mine = (points ?? []).filter((p) => sgDate(0, new Date(p.time)) === today && Number.isFinite(p.value));
  if (!mine.length || (now.getTime() + 8 * 3600_000) % 86400_000 < 3600_000) return null;
  return mine.map((p) => p.value);
}

/** Cigarettes so far today, unrounded: hourly readings since 00:00 SGT summed, over 24 hours, per cigarette. Null before 1am or with no readings. */
export function exactSoFar(points: HourPoint[] | undefined, now = new Date()): number | null {
  const values = readingsToday(points, now);
  return values && values.reduce((a, v) => a + v, 0) / 24 / PM25_PER_CIGARETTE;
}

/** Cigarettes so far today, rounded like cigarettes(). */
export function cigarettesSoFar(points: HourPoint[] | undefined, now = new Date()): number | null {
  const x = exactSoFar(points, now);
  return x == null ? null : cigarettes(x * PM25_PER_CIGARETTE);
}

/** Most cigarette icons drawn in a row. */
export const MAX_ICONS = 10;

/**
 * Icons for `exact` cigarettes so far: whole ones are burnt stubs and the current one is lit, partly burnt by the
 * fraction. Past MAX_ICONS each icon stands for `per` cigarettes (1 decimal).
 */
export function packIcons(exact: number): { per: number; icons: { burnt: number; lit: boolean }[] } {
  const per = exact >= MAX_ICONS ? Math.round((exact / MAX_ICONS) * 10) / 10 : 1;
  const units = exact / per;
  const current = Math.min(Math.floor(units), MAX_ICONS - 1);
  const icons = Array.from({ length: current + 1 }, (_, i) =>
    i < current ? { burnt: 1, lit: false } : { burnt: Math.min(units - i, 0.95), lit: true },
  );
  return { per, icons };
}
