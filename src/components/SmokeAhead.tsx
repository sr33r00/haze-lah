import { AHEAD_FIRES, hoursText } from "@/lib/replay";
import { fmtDayHour } from "@/lib/format";
import type { Ahead } from "@/lib/types";

/** "Smoke on the way": when smoke from today's strongest fires should reach Singapore, from the wind forecast. */
export default function SmokeAhead({ ahead }: { ahead: Ahead }) {
  const { fires, checked, area, hours, at } = ahead;
  const reaching = fires > 0 && hours != null && at != null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-[15px] font-bold text-fg">{reaching ? "Smoke on the way" : "No smoke on the way"}</h3>
      <p className="mt-1 text-[15px] text-fg">
        {reaching
          ? `Smoke from ${fires} of today's ${checked} ${checked < AHEAD_FIRES ? "" : "strongest "}fires should reach Singapore in about ${hoursText(hours)}.${area ? ` Most of it comes from ${area}.` : ""} Expected around ${fmtDayHour(at)}.`
          : "Wind in the next 3 days carries smoke from today's strongest fires away from Singapore."}
      </p>
      <p className="mt-2 text-[13px] text-muted">From the wind forecast about 1.5 km up. Rain and changes in the wind can change this.</p>
    </div>
  );
}
