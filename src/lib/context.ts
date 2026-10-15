import type { HazeData } from "./types";

const POINTS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

/** Compass word for the direction wind blows from; Open-Meteo wind direction is degrees "from". */
export const windFrom = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

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
