import { LEVEL_NAME, psiLevel } from "./bands";
import { mapContext } from "./context";
import { aheadParts, trailCaption } from "./replay";
import { islandMax } from "./situation";
import type { HazeData, Replay } from "./types";

/** Today in a few sentences, for screen readers, crawlers and a device that cannot run the globe. */
export function summaryOf(data: HazeData, replay: Replay | null): string[] {
  const lines: string[] = [];
  const psi = data.nea ? islandMax(data.nea.psi24) : null;
  if (psi) lines.push(`Singapore's highest 24-hour PSI is ${psi.psi} (${LEVEL_NAME[psiLevel(psi.psi)]}), in the ${psi.region} region.`);
  const context = mapContext(data);
  if (context) lines.push(context);
  const day = replay?.days.at(-1);
  if (day) {
    lines.push(trailCaption(day));
    const ahead = day.ahead && aheadParts(day.ahead);
    if (ahead) lines.push([ahead.reach, ahead.source, ahead.expected].filter(Boolean).join(" "));
  }
  return lines;
}
