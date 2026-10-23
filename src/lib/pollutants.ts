import { LEVEL_NAME, PM25_BANDS } from "@/lib/bands";

export type PollutantId = "pm25" | "pm10" | "co" | "no2" | "so2" | "o3" | "dust";

export type Pollutant = {
  id: PollutantId;
  label: string;
  unit: string;
  /** Open-Meteo air-quality (CAMS) variable. */
  camsVar: string;
  /** Upper limits of bands 0 to 2 (band 3 above), in the CAMS unit; null where there are no bands (dust). */
  bands: [number, number, number] | null;
  /** Where the band limits come from. */
  source: string;
};

const NEA_PSI = "NEA, Computation of the Pollutant Standards Index (PSI), updated March 2014, https://www.haze.gov.sg/docs/default-source/faq/computation-of-the-pollutant-standards-index-(psi).pdf";

/**
 * In picker order. Band limits are the PSI breakpoints at sub-index 50, 100 and 200 (NEA table above), kept in the unit CAMS
 * reports. NEA averages differ (24-hour PM10 and SO2, 8-hour CO and O3); they are applied to the model's hourly values as a guide.
 */
export const POLLUTANTS: Pollutant[] = [
  { id: "pm25", label: "PM2.5", unit: "µg/m³", camsVar: "pm2_5", bands: [55, 150, 250], source: "NEA 1-hour PM2.5 bands I to IV (PM25_BANDS), https://www.haze.gov.sg" },
  // 24-hour PM10: 50, 150, 350 µg/m³ at sub-index 50, 100, 200.
  { id: "pm10", label: "PM10", unit: "µg/m³", camsVar: "pm10", bands: [50, 150, 350], source: NEA_PSI },
  // 8-hour CO: 5.0, 10.0, 17.0 mg/m³; CAMS gives µg/m³, so × 1000.
  { id: "co", label: "CO", unit: "µg/m³", camsVar: "carbon_monoxide", bands: [5000, 10000, 17000], source: NEA_PSI },
  {
    id: "no2",
    label: "NO₂",
    unit: "µg/m³",
    camsVar: "nitrogen_dioxide",
    // 25: WHO 2021 air quality guideline, 24-hour mean (https://www.who.int/publications/i/item/9789240034228).
    // 200: WHO 1-hour guideline (WHO Air Quality Guidelines, global update 2005, https://www.who.int/publications/i/item/WHO-SDE-PHE-OEH-06.02; the 2021 update dropped the 1-hour value).
    // 1130: NEA reports a NO2 sub-index only from 1-hour 1130 µg/m³, which is PSI 200 (NEA table above).
    bands: [25, 200, 1130],
    source: `WHO 2021 (24-hour, 25), WHO 2005 (1-hour, 200) and ${NEA_PSI} (1130)`,
  },
  // 24-hour SO2: 80, 365, 800 µg/m³.
  { id: "so2", label: "SO₂", unit: "µg/m³", camsVar: "sulphur_dioxide", bands: [80, 365, 800], source: NEA_PSI },
  // 8-hour O3: 118, 157, 235 µg/m³.
  { id: "o3", label: "O₃", unit: "µg/m³", camsVar: "ozone", bands: [118, 157, 235], source: NEA_PSI },
  // No health bands: the same ramp is stretched evenly over 0 to DUST_TOP.
  { id: "dust", label: "Dust", unit: "µg/m³", camsVar: "dust", bands: null, source: "No health limits; plain low to high scale, 0 to 500 µg/m³ (Open-Meteo CAMS dust)" },
];

/** The pollutant with this id. */
export const pollutant = (id: PollutantId): Pollutant => POLLUTANTS.find((p) => p.id === id)!;

/** PM2.5, the pollutant the Now page's smoke map shows. */
export const PM25 = pollutant("pm25");

/** Top of the dust ramp, µg/m³. */
const DUST_TOP = 500;

/** PM2.5 names are NEA's band names. */
export const BAND_NAMES = PM25_BANDS.map((b) => b.name) as string[];

/** Band names of a pollutant: NEA's for PM2.5, else the PSI words for sub-index 0 to 50, 51 to 100, 101 to 200 and above. */
export const bandNames = (p: Pollutant): string[] => (p.id === "pm25" ? BAND_NAMES : LEVEL_NAME.slice(0, 4));

/** Band of `v`: 0 up to the first limit (inclusive), 3 above the last. Dust has no bands, and a missing or NaN value has none either: both give 0 (check `p.bands`). */
export function bandOf(p: Pollutant, v: number): 0 | 1 | 2 | 3 {
  if (!p.bands || !Number.isFinite(v)) return 0;
  const i = p.bands.findIndex((limit) => v <= limit);
  return (i < 0 ? 3 : i) as 0 | 1 | 2 | 3;
}

/**
 * Where `v` sits on the shared ramp: 0 = none, 1 = band 0 limit, 2 = band 1 limit, 3 = band 2 limit, 4 = twice the band 2 limit
 * (held at 4 above). Dust is linear over 0 to DUST_TOP.
 */
function position(p: Pollutant, v: number): number {
  if (!(v > 0)) return 0; // also NaN and null
  if (!p.bands) return Math.min(4, (v / DUST_TOP) * 4);
  const edges = [0, ...p.bands, p.bands[2] * 2];
  const x = Math.min(v, edges[4]);
  const i = Math.max(1, edges.findIndex((e) => x <= e));
  return i - 1 + (x - edges[i - 1]) / (edges[i] - edges[i - 1]);
}

type Rgb = [number, number, number];
type Stop = [at: number, rgb: Rgb, alpha: number];

/** Below this share of the band 0 limit the air is clean: nothing is drawn (PM2.5: 20 of 55 µg/m³). */
const CLEAR = 20 / 55;

/**
 * The smoke ramp on band position: a smoky veil that only looks dangerous when the air is. Normal is a faint grey-brown at most
 * (alpha 0.16 at the limit); Elevated turns to brown haze, High to rust, Very high to dark blood red.
 * For PM2.5 this is the spike's palette: stops at 20, 55, 100, 150, 250 and 350 µg/m³ (position 1.5 is 102 µg/m³).
 */
const STOPS: Stop[] = [
  [CLEAR, [150, 140, 120], 0],
  [1, [165, 140, 105], 0.16],
  [1.5, [175, 120, 70], 0.5],
  [2, [170, 90, 50], 0.66],
  [3, [150, 40, 35], 0.76],
  [3.4, [110, 20, 35], 0.82],
  [4, [110, 20, 35], 0.82],
];

/** Colour at ramp position `at`, linear between stops; transparent at or below CLEAR. */
function rampAt(at: number): [number, number, number, number] {
  if (at <= CLEAR) return [0, 0, 0, 0];
  const i = Math.max(1, STOPS.findIndex(([s]) => at <= s));
  const [a, ca, aa] = STOPS[i - 1];
  const [b, cb, ab] = STOPS[i];
  const t = Math.min(1, (at - a) / (b - a));
  const mix = (x: number, y: number) => x + (y - x) * t;
  return [mix(ca[0], cb[0]), mix(ca[1], cb[1]), mix(ca[2], cb[2]), mix(aa, ab)];
}

/** Colour and opacity (a in 0..1) of a concentration in the pollutant's unit; transparent for a missing or NaN value. */
export const colorOf = (p: Pollutant, v: number): [r: number, g: number, b: number, a: number] => rampAt(position(p, v));

/**
 * CSS gradient for the legend: the same ramp across band positions 0 to 4, so band limits sit at 25, 50 and 75 per cent.
 * Every pollutant shares the ramp (the labels differ, not the colours), so `p` only keeps the call site uniform.
 */
export function rampCss(p: Pollutant): string {
  void p;
  const at = [0, CLEAR, ...STOPS.slice(1).map(([s]) => s)];
  const parts = at.map((s) => {
    const [r, g, b, a] = rampAt(s);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)}) ${((s / 4) * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
