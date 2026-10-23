import { WIND_HEIGHT } from "@/lib/links";
import { AHEAD_NONE, aheadParts } from "@/lib/replay";
import type { Ahead } from "@/lib/types";

/** "Smoke on the way": when smoke from today's strongest fires should reach Singapore, from the wind forecast. */
export default function SmokeAhead({ ahead }: { ahead: Ahead }) {
  const parts = aheadParts(ahead);
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-[15px] font-bold text-fg">{parts ? "Smoke on the way" : "No smoke on the way"}</h3>
      <p className="mt-1 text-[15px] text-fg">
        {parts
          ? [parts.reach, parts.source, parts.expected].filter(Boolean).join(" ")
          : AHEAD_NONE}
      </p>
      <p className="mt-2 text-[13px] text-muted">From the wind forecast {WIND_HEIGHT}. Rain and changes in the wind can change this.</p>
    </div>
  );
}
