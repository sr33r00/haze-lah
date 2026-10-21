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

/** The NEA region whose label point is nearest. */
export function nearestRegion(lat: number, lon: number): Region {
  return REGIONS.reduce((best, r) => {
    const d = (p: [number, number]) => (p[0] - lat) ** 2 + (p[1] - lon) ** 2;
    return d(REGION_POINT[r]) < d(REGION_POINT[best]) ? r : best;
  });
}

export const LEVEL_NAME = ["Good", "Moderate", "Unhealthy", "Very unhealthy", "Hazardous"] as const;

// Colours follow NEA's PSI legend (green, blue, yellow, orange, red).
export const LEVEL_COLOR = ["#3f9a6b", "#3c7db0", "#d9a118", "#d2662a", "#9e2b35"] as const;

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

/** Colour for a 1-hr PM2.5 value: Normal is green, then the colours of the PSI rows it corresponds to. */
export function pm25Color(pm: number) {
  return [LEVEL_COLOR[0], LEVEL_COLOR[2], LEVEL_COLOR[3], LEVEL_COLOR[4]][pm25Band(pm).index];
}

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

/** One linear segment: concentration range [clo, chi] maps to index range [ilo, ihi]. */
type Segment = readonly [clo: number, chi: number, ilo: number, ihi: number];

/** Linear interpolation on the first segment whose top reaches `c`. Past the last segment: null, or its slope when `extend`. */
function interpolate(segments: readonly Segment[], c: number, extend = false): number | null {
  const s = segments.find((seg) => c <= seg[1]) ?? (extend ? segments[segments.length - 1] : undefined);
  return s ? s[2] + ((c - s[0]) / (s[1] - s[0])) * (s[3] - s[2]) : null;
}

/**
 * NEA PSI sub-index for 24-hour mean PM2.5 (µg/m³). Linear interpolation
 * between the published breakpoints; matches NEA's published sub-index values.
 */
const PM25_PSI_SEGMENTS: Segment[] = [
  [0, 12, 0, 50],
  [12, 55, 50, 100],
  [55, 150, 100, 200],
  [150, 250, 200, 300],
  [250, 350, 300, 400],
  [350, 500, 400, 500],
];

export function pm25ToPsi(c: number): number {
  if (c <= 0) return 0;
  const psi = interpolate(PM25_PSI_SEGMENTS, c);
  return psi == null ? 500 : Math.floor(psi);
}

/**
 * US AQI breakpoints for PM2.5 (µg/m³) as AQICN uses them: the US EPA table before its 2024 update
 * (AQICN, https://aqicn.org/scale/, "US-EPA 2016 standard"). On 21 Oct 2026 this table, rounded down,
 * gave AQICN's figure for all five NEA regions from NEA's 1-hour PM2.5; the 2024 table did not.
 */
const PM25_US_AQI_SEGMENTS: Segment[] = [
  [0, 12, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

/**
 * US AQI for a 1-hour PM2.5 reading, the number AQICN shows for the same NEA reading.
 * The concentration is cut to 1 decimal and the result rounded down, as AQICN does. Above 500.4 the last slope continues.
 */
export function pm25ToUsAqi(c: number): number {
  if (c <= 0) return 0;
  return Math.floor(interpolate(PM25_US_AQI_SEGMENTS, Math.floor(c * 10 + 1e-9) / 10, true) ?? 0);
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
  detail: string;
};

/** NEA's advice steps, mildest first. The 24-hr PSI advisory rows above use these exact phrases. */
export const STEP_TEXT = [
  "Normal activities",
  "Reduce prolonged or strenuous outdoor physical exertion",
  "Minimise prolonged or strenuous outdoor physical exertion",
  "Avoid prolonged or strenuous outdoor physical exertion",
  "Minimise outdoor activity",
  "Avoid outdoor activity",
] as const;
export type Step = 0 | 1 | 2 | 3 | 4 | 5;

const psiStep = (level: Level, group: Group) => STEP_TEXT.indexOf(NEA_ADVICE[group][level] as (typeof STEP_TEXT)[number]) as Step;

/**
 * NEA's personal guide for the 1-hr PM2.5 bands I to IV (haze.gov.sg PSI and PM2.5 guide, June 2026; MOH haze advisory):
 * everyone reduces, then avoids, strenuous outdoor activity, then minimises all outdoor activity; vulnerable persons
 * (elderly, pregnant women, children, heart or lung disease) avoid strenuous outdoor activity from band II and all
 * outdoor activity from band III.
 */
const PM25_STEP: Record<"general" | "vulnerable", Step[]> = { general: [0, 1, 3, 4], vulnerable: [0, 3, 5, 5] };

export const pm25Step = (pm: number, group: Group): Step => PM25_STEP[group === "healthy" ? "general" : "vulnerable"][pm25Band(pm).index];

/**
 * Advice for now. NEA's guide: for activities in the next few hours use the latest 1-hr PM2.5 and the personal guide;
 * the 24-hr PSI forecast is for planning the next day. The 24-hr PSI is used only when there is no PM2.5 reading.
 */
export function adviceStep(pm25: number | null, psi: number | null, group: Group): Step | null {
  if (pm25 != null && Number.isFinite(pm25)) return pm25Step(pm25, group);
  if (psi != null && Number.isFinite(psi)) return psiStep(psiLevel(psi), group);
  return null;
}

/**
 * Plain-language verdict for an advice step. MOH: unless PM2.5 is in band IV or the PSI forecast is Hazardous, healthy
 * people can generally carry on outdoors at reduced intensity or duration, so short trips stay fine below that.
 */
export function verdictFor(step: Step): Verdict {
  switch (step) {
    case 0:
      return { tone: "go", headline: "Go ahead.", detail: "The air is fine for normal activities." };
    case 1:
      return { tone: "easy", headline: "Cut back outdoors.", detail: "Short trips are fine. Skip long runs and hard exercise outside." };
    case 2:
      return { tone: "limit", headline: "Keep outings short.", detail: "Keep long or hard exercise outdoors to a minimum." };
    case 3:
      return { tone: "limit", headline: "Keep outings short.", detail: "No long or hard exercise outdoors." };
    case 4:
      return { tone: "stay", headline: "Stay in if you can.", detail: "Keep time outdoors to a minimum." };
    case 5:
      return { tone: "stay", headline: "Stay indoors.", detail: "Avoid going outside." };
  }
}

/** Verdict for a 24-hr PSI level (forecast days, island summaries). */
export const verdict = (level: Level, group: Group): Verdict => verdictFor(psiStep(level, group));

/** Hero and plan colours per verdict tone; text colours pass WCAG AA on their background. */
export const TONE_COLOR: Record<Verdict["tone"], { bg: string; fg: string }> = {
  go: { bg: "#2e7d55", fg: "#ffffff" },
  easy: { bg: "#eba21c", fg: "#1d1a10" },
  limit: { bg: "#c24e17", fg: "#ffffff" },
  stay: { bg: "#a91d1d", fg: "#ffffff" },
};
