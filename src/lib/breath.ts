import { readingsToday } from "./cigarettes";
import type { HourPoint } from "./types";

/**
 * Air an adult breathes in a day, m³: mean for adults aged 31 to under 51.
 * US EPA, Exposure Factors Handbook (2011), Chapter 6, Table 6-1.
 */
export const BREATH_M3_PER_DAY = 16;

/**
 * Annual mean PM2.5 in Singapore, µg/m³ (12 in 2025 and in 2024): a "normal day".
 * NEA via SingStat, data.gov.sg dataset "Air Pollution Levels, Annual".
 */
export const NORMAL_PM25 = 12;

export const BREATH_SOURCES = [
  ["US EPA, 2011", "https://www.epa.gov/expobox/exposure-factors-handbook-chapter-6"],
  ["NEA annual PM2.5", "https://data.gov.sg/datasets/d_8f5fa022cbda68494fa70e788600505b/view"],
] as const;

export const BREATH_NOTES = [
  `Times a normal day: today's 24-hour PM2.5 divided by ${NORMAL_PM25} µg/m³. ${NORMAL_PM25} µg/m³ is the yearly average PM2.5 in Singapore in 2025 (NEA).`,
  `Fine dust breathed: an adult breathes about ${BREATH_M3_PER_DAY} m³ of air a day (US EPA). Each hour is ${BREATH_M3_PER_DAY} ÷ 24 m³. The card adds each hour's PM2.5 since midnight and multiplies it by that air.`,
  "Both numbers assume you breathe outdoor air all day. Indoors with windows closed and an air purifier, you breathe less. Exercise makes you breathe more.",
];

/** Today's 24-hour PM2.5 against a normal day: the "5.8×" number and a short label. */
export function timesNormal(pm25: number): { big: string; label: string } | null {
  if (!Number.isFinite(pm25)) return null;
  const x = Math.max(0, pm25) / NORMAL_PM25;
  const r = Math.round(x * 10) / 10;
  const big = `${r < 10 ? r.toFixed(1) : Math.round(x)}×`;
  if (x < 0.85) return { big, label: "Cleaner than a normal day" };
  if (x < 1.15) return { big, label: "About a normal day" };
  return { big, label: "a normal day's PM2.5" };
}

/** Micrograms as "0.9 mg", or "60 µg" under 0.1 mg (no line break before the unit). */
export const fmtDust = (ug: number) => (ug < 100 ? `${Math.round(ug)}\u00a0µg` : `${(ug / 1000).toFixed(1)}\u00a0mg`);

/** Fine dust breathed since 00:00 SGT, and what a normal day gives for the same hours (µg). Null like `exactSoFar`. */
export function dustSoFar(points: HourPoint[] | undefined, now = new Date()): { ug: number; normalUg: number } | null {
  const values = readingsToday(points, now);
  if (!values) return null;
  const perHour = BREATH_M3_PER_DAY / 24;
  return { ug: values.reduce((a, v) => a + v, 0) * perHour, normalUg: NORMAL_PM25 * values.length * perHour };
}
