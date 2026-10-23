import type { HazeData } from "./types";

const POINTS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

const SHORT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const point = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 45) % 8;

/** Compass word for the direction wind blows from; Open-Meteo wind direction is degrees "from". */
export const windFrom = (deg: number) => POINTS[point(deg)];

/** The same as a short label: "SW". */
export const windFromShort = (deg: number) => SHORT[point(deg)];

/** One line of context for the smoke map: current wind and satellite fire counts. */
export function mapContext({ weather, fires }: HazeData): string | null {
  const parts: string[] = [];
  const w = weather[0];
  if (w && !isNaN(w.windDir)) parts.push(`Upper winds from the ${windFrom(w.windDir)}, ${Math.round(w.windSpeed)} km/h`);
  if (fires.available) {
    parts.push(`${fires.sumatra.toLocaleString()} fire hotspots in Sumatra, ${fires.borneo.toLocaleString()} in Borneo, last ${fires.days} days`);
  }
  return parts.length ? parts.join(". ") + "." : null;
}

/**
 * Wind directions (degrees, "from") that bring smoke from each fire area to Singapore. NEA's Haze
 * Situation Updates attribute southwesterly winds to Sumatra smoke and southeasterly winds to
 * Kalimantan (Borneo) smoke.
 */
const SMOKE_SECTORS = { sumatra: [190, 300], borneo: [90, 160] } as const;

type SmokeSource = keyof typeof SMOKE_SECTORS;

export function windSource(deg: number): SmokeSource | null {
  const d = ((deg % 360) + 360) % 360;
  return (Object.keys(SMOKE_SECTORS) as SmokeSource[]).find((k) => d >= SMOKE_SECTORS[k][0] && d <= SMOKE_SECTORS[k][1]) ?? null;
}
