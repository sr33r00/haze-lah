import { fmtDateShort, fmtWeekday } from "@/lib/format";
import { GLOBE_LAYERS, fmtReading, isClear, rampRgb, rampT, type GlobeLayer } from "@/lib/globe";

/**
 * The days of the frames as a bar chart that is also the scrubber: one button per day, as tall as the reading over Singapore
 * that day and coloured by the layer's ramp. `values` are those readings by date; none yet while they load.
 */
export default function DayBars({
  layer,
  dates,
  values,
  today,
  selected,
  onPick,
}: {
  layer: GlobeLayer;
  dates: string[];
  values: Record<string, number | null> | undefined;
  today: string;
  selected: number;
  onPick: (i: number) => void;
}) {
  const { ramp } = GLOBE_LAYERS[layer];
  return (
    <div role="group" aria-label="Day" className="flex h-[76px] min-w-0 flex-1 gap-1">
      {dates.map((date, i) => {
        const value = values?.[date] ?? null;
        const t = value === null || isClear(layer, value) ? null : rampT(ramp, value);
        // A bar as tall and coloured as its reading; a short grey stub for a day with none or a clear one; a pulsing one while the readings load.
        const bar = !values ? { cls: "h-2/5 bg-line motion-safe:animate-pulse" } : t === null ? { cls: "h-[8%] bg-line" } : { cls: "", style: { height: `${Math.max(10, t * 100)}%`, background: `rgb(${rampRgb(ramp, t)})` } };
        return (
          <button
            key={date}
            onClick={() => onPick(i)}
            aria-pressed={i === selected}
            aria-label={`${fmtDateShort(date)}, ${value === null ? "no reading" : fmtReading(layer, value)}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 pb-1 pt-1.5 transition-colors aria-pressed:bg-surface"
          >
            <span className="flex w-full flex-1 items-end justify-center">
              <span
                aria-hidden
                className={`w-full max-w-6 rounded-t-md ${bar.cls} ${i === selected ? "" : "opacity-70"}`}
                style={bar.style}
              />
            </span>
            <span className={`text-[10px] leading-none ${i === selected ? "font-bold text-fg" : "text-muted"}`}>{date === today ? "Today" : fmtWeekday(date)}</span>
          </button>
        );
      })}
    </div>
  );
}
