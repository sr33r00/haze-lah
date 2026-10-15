// Official Singapore NEA bands and health advisory.
// Sources: NEA "Air quality and health advisory" (www.haze.gov.sg, www.nea.gov.sg).

export type Group = "healthy" | "sensitive" | "chronic";
export type Region = "north" | "south" | "east" | "west" | "central";

export const REGIONS: Region[] = ["north", "south", "east", "west", "central"];

/** Label points NEA publishes for each region. */
export const REGION_POINT: Record<Region, [number, number]> = {
  north: [1.418, 103.82],
  south: [1.296, 103.82],
  east: [1.352, 103.94],
  west: [1.352, 103.7],
  central: [1.357, 103.82],
};

export const GROUP_LABEL: Record<Group, string> = {
  healthy: "Healthy adult",
  sensitive: "Child, elderly or pregnant",
  chronic: "Heart or lung condition",
};

export type Level = 0 | 1 | 2 | 3 | 4; // good, moderate, unhealthy, very unhealthy, hazardous

export const LEVEL_NAME = ["Good", "Moderate", "Unhealthy", "Very unhealthy", "Hazardous"] as const;

// Colours follow NEA's PSI legend (green, blue, yellow, orange, red).
export const LEVEL_COLOR = ["#16a34a", "#2563eb", "#eab308", "#ea580c", "#dc2626"] as const;

/** Readable text colours for each level (theme-aware CSS variables). */
export const LEVEL_TEXT = ["var(--lv0)", "var(--lv1)", "var(--lv2)", "var(--lv3)", "var(--lv4)"] as const;

/** 24-hour PSI to NEA descriptor level. */
export function psiLevel(psi: number): Level {
  if (psi <= 50) return 0;
  if (psi <= 100) return 1;
  if (psi <= 200) return 2;
  if (psi <= 300) return 3;
  return 4;
}

/** NEA 1-hour PM2.5 concentration bands (µg/m³). */
export const PM25_BANDS = [
  { max: 55, name: "Normal", band: "I" },
  { max: 150, name: "Elevated", band: "II" },
  { max: 250, name: "High", band: "III" },
  { max: Infinity, name: "Very high", band: "IV" },
] as const;

export function pm25Band(pm: number) {
  const i = PM25_BANDS.findIndex((b) => pm <= b.max);
  return { index: i, ...PM25_BANDS[i] };
}

/**
 * Map a 1-hour PM2.5 band to the PSI advisory row it corresponds to, so one
 * piece of advice can use both numbers. Band I covers Good and Moderate.
 */
export function pm25ToLevel(pm: number): Level {
  if (pm <= 55) return 1;
  if (pm <= 150) return 2;
  if (pm <= 250) return 3;
  return 4;
}

/**
 * NEA PSI sub-index for 24-hour mean PM2.5 (µg/m³). Linear interpolation
 * between the published breakpoints; matches NEA's published sub-index values.
 */
const PM25_BREAKS: [number, number][] = [
  [0, 0],
  [12, 50],
  [55, 100],
  [150, 200],
  [250, 300],
  [350, 400],
  [500, 500],
];

export function pm25ToPsi(c: number): number {
  if (c <= 0) return 0;
  for (let i = 1; i < PM25_BREAKS.length; i++) {
    const [c0, p0] = PM25_BREAKS[i - 1];
    const [c1, p1] = PM25_BREAKS[i];
    if (c <= c1) return Math.floor(p0 + ((c - c0) / (c1 - c0)) * (p1 - p0));
  }
  return 500;
}

/** Level for a neighbouring station: its API if measured, else modelled PM2.5. */
export function stationLevel(s: { api: number | null; pm25: number | null }): Level | null {
  if (s.api != null) return psiLevel(s.api);
  if (s.pm25 != null) return pm25ToLevel(s.pm25);
  return null;
}

/** NEA advisory text by 24-hr PSI level and group. Levels 0 and 1 share "normal activities". */
export const NEA_ADVICE: Record<Group, string[]> = {
  healthy: [
    "Normal activities",
    "Normal activities",
    "Reduce prolonged or strenuous outdoor physical exertion",
    "Avoid prolonged or strenuous outdoor physical exertion",
    "Minimise outdoor activity",
  ],
  sensitive: [
    "Normal activities",
    "Normal activities",
    "Minimise prolonged or strenuous outdoor physical exertion",
    "Minimise outdoor activity",
    "Avoid outdoor activity",
  ],
  chronic: [
    "Normal activities",
    "Normal activities",
    "Avoid prolonged or strenuous outdoor physical exertion",
    "Avoid outdoor activity",
    "Avoid outdoor activity",
  ],
};

export type Verdict = {
  tone: "go" | "easy" | "limit" | "stay";
  headline: string;
  emoji: string;
};

/** Plain-language verdict for a group at a level, derived from the NEA advice row. */
export function verdict(level: Level, group: Group): Verdict {
  const advice = NEA_ADVICE[group][level];
  if (advice === "Normal activities") return { tone: "go", headline: "Yes, go out", emoji: "✅" };
  if (advice.startsWith("Reduce")) return { tone: "easy", headline: "Yes, but take it easy", emoji: "🚶" };
  if (advice.includes("exertion")) return { tone: "limit", headline: "Short trips only, no exercise", emoji: "⚠️" };
  if (advice.startsWith("Minimise")) return { tone: "limit", headline: "Stay in if you can", emoji: "🏠" };
  return { tone: "stay", headline: "Stay indoors", emoji: "🛑" };
}

export const TONE_COLOR: Record<Verdict["tone"], string> = {
  go: "#16a34a",
  easy: "#b45309",
  limit: "#ea580c",
  stay: "#dc2626",
};
