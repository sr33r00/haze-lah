import { TONE_COLOR, type Group } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import { bestWindow, planHours } from "@/lib/plan";
import type { ForecastPoint } from "@/lib/types";
import { sgDate } from "@/lib/util";

const LEGEND = ["go", "easy", "limit", "stay"] as const;
const LEGEND_NAME = { go: "Go ahead", easy: "Cut back", limit: "Keep short", stay: "Stay indoors" };

/** Next 24 hours as a coloured strip, with the best 3-hour window outlined. */
export default function PlanDay({ hourly, group }: { hourly: ForecastPoint[]; group: Group }) {
  const hours = planHours(hourly, group);
  if (!hours.length) return <p className="px-4 text-[15px] text-muted">Forecast unavailable.</p>;
  const best = bestWindow(hours, group);
  const day = best ? (sgDate(0, new Date(best.start)) === sgDate(0) ? "today" : "tomorrow") : "";
  // Bar height is PM2.5, on a scale that always reaches NEA band III (150).
  const top = Math.max(150, ...hours.map((h) => h.pm25));

  const summary = best
    ? `Best time out: ${fmtHour(best.start)} to ${fmtHour(best.end)} ${day}, PM2.5 about ${Math.round(best.meanPm25)}`
    : "No good 3-hour window in the next 24 hours";

  return (
    <div className="px-4">
      <p className="text-[17px] font-bold">{summary}</p>
      <ol
        aria-label={`Next 24 hours. ${summary}. ${hours.map((h) => `${fmtHour(h.time)} ${h.verdict.headline}`).join(" ")}`}
        className="relative mt-3 flex gap-px"
      >
        {hours.map((h, i) => (
          <li key={h.time} className="min-w-0 flex-1 text-center">
            <div className="flex h-12 items-end">
              <div
                className="w-full origin-bottom animate-grow rounded-t-sm"
                style={{ height: `${Math.max(12, (h.pm25 / top) * 100)}%`, background: TONE_COLOR[h.verdict.tone].bg, animationDelay: `${i * 20}ms` }}
                title={`${fmtHour(h.time)}: PM2.5 ${Math.round(h.pm25)}`}
              />
            </div>
            <div aria-hidden className="mt-1 h-4 text-[11px] text-muted">
              {i % 3 === 0 && <span className="whitespace-nowrap">{fmtHour(h.time)}</span>}
            </div>
          </li>
        ))}
        {best && (
          <li
            aria-hidden
            className="pointer-events-none absolute -top-1 h-14 rounded-md border-2 border-fg"
            style={{ left: `${(best.startIndex / hours.length) * 100}%`, width: `${(3 / hours.length) * 100}%` }}
          />
        )}
      </ol>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {LEGEND.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE_COLOR[t].bg }} />
            {LEGEND_NAME[t]}
          </li>
        ))}
      </ul>
    </div>
  );
}
