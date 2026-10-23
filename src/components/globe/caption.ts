import { fmtDateShort } from "@/lib/format";
import { globeDates } from "@/lib/globe";
import { bandNames, bandOf, pollutant } from "@/lib/pollutants";
import { aheadParts, fromDirection, newZonesText, trailCaption, windAtSg, windText } from "@/lib/replay";
import type { ReplayDay } from "@/lib/types";
import { SG } from "@/lib/util";
import { sample } from "@/lib/wind";
import type { GlobeDay, LayerChoice } from "./frame";

/** What the card says about a day. `live` is the live replay's day for the same date (it knows the fires the air passed), `fires` the day's fire count, `psi` Singapore's highest 24-hr PSI. */
export type CaptionInput = { day: GlobeDay; layer: LayerChoice; live?: ReplayDay; fires: number | null; psi?: number; now?: number };

/**
 * The headline and the facts of a day. The headline is where the air came from (a forecast day: where it should come from), or, on
 * a day with smoke on the way, when that smoke should reach Singapore; the air's path then moves to the facts. Pure.
 */
export function captionOf({ day, layer, live, fires, psi, now = Date.now() }: CaptionInput): { headline: string; facts: string[] } {
  const future = day.kind === "forecast";
  const origin = live ?? (day.trail.length ? { from: fromDirection(day.trail), area: null, near: 0 } : null);
  const path = origin ? trailCaption(origin, future) : null;
  const ahead = day.kind === "today" && live?.ahead ? aheadParts(live.ahead) : null;
  const headline = ahead?.reach ?? path ?? "No air path for this day.";

  const facts: string[] = [];
  if (ahead) facts.push(...[ahead.source, ahead.expected, path].filter((f): f is string => f != null));
  const p = layer === "off" || layer === "smoke" ? null : pollutant(layer);
  const v = p && day.field ? sample({ ...day.grid, data: day.field }, SG.lat, SG.lon) : null;
  if (p && v != null) {
    const band = p.bands ? `, ${bandNames(p)[bandOf(p, v)]}` : "";
    facts.push(`Model ${p.label} over Singapore: ${Math.round(v).toLocaleString("en-SG")} ${p.unit}${band}`);
  }
  if (layer === "smoke") {
    const latest = globeDates(now).at(-1)!; // NASA's newest pass: today's only from the evening
    if (future) facts.push("No satellite picture for this day.");
    else if (day.date > latest) facts.push(`Satellite picture: the latest pass, ${fmtDateShort(latest)}`);
  }
  if (fires != null && !(day.kind === "today" && fires === 0)) facts.push(fires === 0 ? "No fires seen in Sumatra and Borneo" : `${fires.toLocaleString("en-SG")} ${fires === 1 ? "fire" : "fires"} in Sumatra and Borneo`);
  if (day.fresh.length) facts.push(newZonesText(day.fresh.length));
  if (psi != null) facts.push(`Highest 24-hour PSI in Singapore: ${psi}`);
  const wind = day.wind && day.grid.lats.length > 1 ? windAtSg(day.grid, day.wind) : null;
  if (wind) facts.push(windText(wind));
  return { headline, facts };
}
