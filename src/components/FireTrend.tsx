import { SOURCE_COLOR } from "@/lib/context";
import type { FireSummary } from "@/lib/types";

const KEYS = ["sumatra", "borneo"] as const;
const NAME = { sumatra: "Sumatra", borneo: "Borneo" };
const day = (date: string) => new Intl.DateTimeFormat("en-SG", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`));

/** Fire hotspots per day, Sumatra and Borneo side by side. */
export default function FireTrend({ daily }: { daily: FireSummary["daily"] }) {
  if (!daily.length) return null;
  const top = Math.max(1, ...daily.flatMap((d) => [d.sumatra, d.borneo]));
  return (
    <div className="px-4 pt-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Fire hotspots per day</h3>
        <ul className="flex gap-3 text-[12px] text-muted">
          {KEYS.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SOURCE_COLOR[k] }} />
              {NAME[k]}
            </li>
          ))}
        </ul>
      </div>
      <ol
        className="mt-2 flex gap-2"
        aria-label={daily.map((d, i) => `${day(d.date)}${i === daily.length - 1 ? " so far" : ""}: Sumatra ${d.sumatra}, Borneo ${d.borneo}`).join(". ")}
      >
        {daily.map((d, i) => (
          <li key={d.date} className="min-w-0 flex-1 text-center">
            <div className="flex h-24 items-end justify-center gap-0.5">
              {KEYS.map((k) => (
                <div key={k} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="tabular text-[10px] leading-none text-muted">{d[k]}</span>
                  <div className="mt-0.5 w-full rounded-t-sm" style={{ height: `${(d[k] / top) * 80}%`, background: SOURCE_COLOR[k] }} />
                </div>
              ))}
            </div>
            <div aria-hidden className="mt-1 text-[12px] text-muted">
              {day(d.date)}
              {i === daily.length - 1 && <span className="block text-[10px] leading-tight">so far</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
