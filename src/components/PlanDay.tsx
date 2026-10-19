"use client";

import { TONE_COLOR, type Group } from "@/lib/bands";
import { ACTIVITIES, ACTIVITY, bestSlots, isOk, type Activity } from "@/lib/exercise";
import { fmtHour } from "@/lib/format";
import { planHours } from "@/lib/plan";
import type { ForecastPoint } from "@/lib/types";
import { useStored } from "./usePrefs";

const LEGEND = ["go", "easy", "limit", "stay"] as const;
const LEGEND_NAME = { go: "Go ahead", easy: "Cut back", limit: "Keep short", stay: "Stay indoors" };

/** Pick an activity, get its cleanest time today and tomorrow; the next 24 hours as a strip with that time outlined. */
export default function PlanDay({ hourly, group }: { hourly: ForecastPoint[]; group: Group }) {
  const [activity, choose] = useStored<Activity>("activity", ACTIVITIES, "out");

  const hours = planHours(hourly, group);
  if (!hours.length) return <p className="px-4 text-[15px] text-muted">Forecast unavailable.</p>;
  const slots = bestSlots(hourly, activity, group);
  const mark = slots.find((s) => s.startIndex < hours.length);
  const len = ACTIVITY[activity].hours;
  // Bar height is PM2.5, on a scale that always reaches NEA band III (150).
  const top = Math.max(150, ...hours.map((h) => h.pm25));

  return (
    <div className="px-4">
      <div role="group" aria-label="Activity" className="flex gap-1 rounded-full bg-surface p-1">
        {ACTIVITIES.map((a) => (
          <button
            key={a}
            onClick={() => choose(a)}
            aria-pressed={a === activity}
            className={`min-h-[36px] min-w-0 flex-1 rounded-full px-1 text-[13px] font-semibold transition-colors ${a === activity ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
          >
            {ACTIVITY[a].label}
          </button>
        ))}
      </div>

      <ul aria-live="polite" className="mt-3 divide-y divide-line">
        {slots.length === 0 && <li className="py-2 text-[15px] text-muted">No forecast for these hours yet.</li>}
        {slots.map((s) => (
          <li key={s.day} className="flex items-baseline gap-3 py-2">
            <span className="w-[4.75rem] shrink-0 text-[13px] font-semibold capitalize text-muted">{s.day}</span>
            <span className="min-w-0 flex-1">
              {/* When even the cleanest hours are too smoky, say so first; the time is then only the least bad. */}
              <span className="tabular block text-[17px] font-bold">{isOk(s.rating) ? `${fmtHour(s.start)} to ${fmtHour(s.end)}` : s.rating.text}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[s.rating.tone].bg }} />
                <span className="font-semibold">{isOk(s.rating) ? s.rating.text : `Least haze ${fmtHour(s.start)} to ${fmtHour(s.end)}`}</span>
                <span className="text-muted">· PM2.5 about {Math.round(s.pm25)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ol
        aria-label={`Next 24 hours for ${group === "healthy" ? "healthy adults" : "your group"}: ${hours.map((h) => `${fmtHour(h.time)} ${h.verdict.headline}`).join(" ")}`}
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
        {mark && (
          <li
            aria-hidden
            className="pointer-events-none absolute -top-1 h-14 rounded-md border-2 border-fg transition-[left,width] duration-300 motion-reduce:transition-none"
            style={{ left: `${(mark.startIndex / hours.length) * 100}%`, width: `${(Math.min(len, hours.length - mark.startIndex) / hours.length) * 100}%` }}
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
