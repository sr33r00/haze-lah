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

/**
 * The air-level colours, one palette for the whole site and used for nothing else: green, amber, orange, red. They are the hero's own
 * fills (`TONE_COLOR`), so one level is one visible colour everywhere; white (green, orange, red) or dark ink (amber) is at least 4.5:1 on them.
 * Green and orange are 3:1 on the page and cards in both themes. Amber is not on light ones and red is not on dark ones, so those two
 * marks carry a 1 px edge (`airMark`). The PSI uses NEA's levels but this scale: Good and Moderate are both green, because "Moderate"
 * is not yet a warning (see the advice below).
 */
export const AIR = { green: "#2b7a52", amber: "#eba21c", orange: "#b94814", red: "#a91d1d" } as const;

/** The edge colour tokens (globals.css, theme-aware, clear where the fill already has 3:1) of the two marks that need one. */
const EDGE: Record<string, string> = { [AIR.amber]: "--edge-amber", [AIR.red]: "--edge-red" };

/** The style of an air mark (a bar, dot or swatch) in `color`: the fill, and for amber and red an inset 1 px edge where the fill alone would be under 3:1 against the page. */
export const airMark = (color: string): { background: string; boxShadow?: string } => (color in EDGE ? { background: color, boxShadow: `inset 0 0 0 1px var(${EDGE[color]})` } : { background: color });

/** The levels' text colours for a server-drawn image on the light page (the same as `--lv0` to `--lv4` in light, which a test keeps in step). */
export const LEVEL_TEXT_LIGHT = ["#2a7650", "#2a7650", "#856100", "#a84a16", "#9e2b35"] as const;
export const LEVEL_COLOR = [AIR.green, AIR.green, AIR.amber, AIR.orange, AIR.red] as const;

/** Relative luminance of a `#rrggbb` colour (WCAG). */
const luminance = (hex: string) => {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
};

/** Text colour for a number on a `#rrggbb` badge: white, or dark ink when that reads better. */
export function textOn(bg: string): string {
  return 1.05 / (luminance(bg) + 0.05) >= (luminance(bg) + 0.05) / 0.0585 ? "#ffffff" : "#0d161d";
}

/** Readable text colours for each level (theme-aware CSS variables); Good and Moderate share the green. */
export const LEVEL_TEXT = ["var(--lv0)", "var(--lv0)", "var(--lv2)", "var(--lv3)", "var(--lv4)"] as const;

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

/** Colour of each 1-hr PM2.5 band: Normal is green, then the colours of the PSI rows it corresponds to. */
export const PM25_COLORS = [AIR.green, AIR.amber, AIR.orange, AIR.red] as const;

/** Colour for a 1-hr PM2.5 value. */
export function pm25Color(pm: number) {
  return PM25_COLORS[pm25Band(pm).index];
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

/**
 * The six US AQI categories with the US EPA AirNow colours (https://www.airnow.gov/aqi/aqi-basics/); the names are
 * AQICN's (https://aqicn.org/scale/). `short`, where given, is the name shortened to fit under a colour bar.
 */
export const US_AQI_BANDS = [
  { from: 0, max: 50, name: "Good", color: "#00e400" },
  { from: 51, max: 100, name: "Moderate", color: "#ffff00" },
  { from: 101, max: 150, name: "Unhealthy for sensitive groups", short: "Sensitive groups", color: "#ff7e00" },
  { from: 151, max: 200, name: "Unhealthy", color: "#ff0000" },
  { from: 201, max: 300, name: "Very unhealthy", color: "#8f3f97" },
  { from: 301, max: Infinity, name: "Hazardous", color: "#7e0023" },
] as const;

/** The US AQI category of an index value. */
export const usAqiBand = (aqi: number) => US_AQI_BANDS.find((b) => aqi <= b.max) ?? US_AQI_BANDS[US_AQI_BANDS.length - 1];

/** Map colour of a US AQI value. */
export const usAqiColor = (aqi: number) => usAqiBand(aqi).color;

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

/** The hero's colours per verdict tone: a solid card with its ink, which passes WCAG AA (4.5:1) even softened to 90%. Marks drawn on a page or card (the plan's bars) use `TONE_MARK`. */
export const TONE_COLOR: Record<Verdict["tone"], { bg: string; fg: string }> = {
  go: { bg: AIR.green, fg: "#ffffff" },
  easy: { bg: AIR.amber, fg: "#1d1a10" },
  limit: { bg: AIR.orange, fg: "#ffffff" },
  stay: { bg: AIR.red, fg: "#ffffff" },
};

/** The same four verdict tones as marks on a page or card (the same colours; see `airMark` for the edge). */
export const TONE_MARK: Record<Verdict["tone"], string> = { go: AIR.green, easy: AIR.amber, limit: AIR.orange, stay: AIR.red };

/** The Now panel's paint for an advice step: a solid verdict colour with a subtle same-hue shade, its ink and a softer ink; neutral with no reading. */
export function heroPaint(step: Step | null) {
  const tone = step != null ? TONE_COLOR[verdictFor(step).tone] : null;
  const ink = tone ? tone.fg : "var(--fg)";
  const bg = tone ? `linear-gradient(180deg, ${tone.bg}, color-mix(in srgb, ${tone.bg} 88%, black))` : "var(--surface)";
  // The group buttons' tray goes the other way from the ink (darker under white ink, lighter under dark ink), so the softer labels on it keep 4.5:1.
  const tray = `color-mix(in srgb, ${tone ? (tone.fg === "#ffffff" ? "black" : "white") : "var(--fg)"} ${tone ? 16 : 14}%, transparent)`;
  return { tone, ink, soft: `color-mix(in srgb, ${ink} 90%, transparent)`, bg, tray };
}
