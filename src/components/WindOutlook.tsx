"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { windFrom, windFromShort } from "@/lib/context";
import { fmtDay, fmtHour } from "@/lib/format";
import { FIRE_COLOR, OUTLOOK_NOTE, fetchReplay } from "@/lib/replay";
import type { OutlookStep } from "@/lib/types";
import { sgDate, sgHour } from "@/lib/util";

/** Fire orange, mixed with the text colour so it reads on both the light and the dark card. */
const FIRE_TEXT = `color-mix(in srgb, ${FIRE_COLOR} 70%, var(--fg))`;

/** Arrow pointing the way the wind blows: the wind comes from `deg`, so it goes the opposite way. */
function Arrow({ deg, size }: { deg: number; size: number }) {
  return <ArrowUp size={size} aria-hidden style={{ transform: `rotate(${deg + 180}deg)` }} />;
}

/** "1,240 fires" and where, or null when no fires are upwind. */
const firesUpwind = ({ near, area }: OutlookStep) => (near > 0 ? { count: `${near.toLocaleString("en-SG")} ${near === 1 ? "fire" : "fires"}`, area } : null);

/** The steps by SGT day, each with its label ("Today", "Tmrw", then the weekday). */
function byDay(steps: OutlookStep[]) {
  const today = Date.parse(sgDate(0));
  const days: { date: string; label: string; steps: OutlookStep[] }[] = [];
  for (const s of steps) {
    const date = sgDate(0, new Date(s.t));
    if (days.at(-1)?.date !== date) days.push({ date, label: fmtDay(date, Math.round((Date.parse(date) - today) / 86400_000)), steps: [] });
    days.at(-1)!.steps.push(s);
  }
  return days;
}

/** The next step in words: the big arrow, where the wind comes from, how fast, and the fires upwind. */
function Lead({ step }: { step: OutlookStep }) {
  const fires = firesUpwind(step);
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-surface p-4">
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-bg text-fg">
        <Arrow deg={step.deg} size={36} />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-muted">Now</div>
        <div className="text-[20px] font-bold leading-tight">
          From the {windFrom(step.deg)}, <span className="tabular whitespace-nowrap">{step.kmh} km/h</span>
        </div>
        <div className="mt-0.5 text-[15px] font-semibold" style={{ color: fires ? FIRE_TEXT : "var(--muted)" }}>
          {fires ? `Over ${fires.count}${fires.area ? ` in ${fires.area}` : ""}` : "No fires upwind"}
        </div>
      </div>
    </div>
  );
}

/** One 3-hour step: time, arrow, direction, speed, fires upwind. On the wide layout it sits in the column of its time of day. */
function Cell({ step }: { step: OutlookStep }) {
  const fires = firesUpwind(step);
  return (
    <li
      className="flex min-h-[44px] w-[92px] shrink-0 flex-col items-center rounded-2xl bg-surface px-1.5 py-2.5 text-center lg:w-auto"
      style={{ gridColumnStart: sgHour(step.t) / 3 + 1 }}
    >
      <span className="tabular text-[13px] font-semibold">{fmtHour(step.t)}</span>
      <span className="my-1.5 text-fg">
        <Arrow deg={step.deg} size={22} />
      </span>
      <span className="text-[15px] font-bold">
        <span aria-hidden>{windFromShort(step.deg)}</span>
        <span className="sr-only">from the {windFrom(step.deg)}</span>
      </span>
      <span className="tabular text-[13px] text-muted">{step.kmh} km/h</span>
      <span className="mt-1.5 text-[13px] font-semibold leading-tight" style={{ color: fires ? FIRE_TEXT : "var(--muted)" }}>
        {fires ? (
          <>
            <span className="tabular">{fires.count}</span>
            {fires.area && <span className="block font-normal">{fires.area}</span>}
          </>
        ) : (
          <span className="font-normal">No fires upwind</span>
        )}
      </span>
    </li>
  );
}

/** Where the wind comes from over the next 3 days, every 3 hours, and the fires it passes over on the way. */
export default function WindOutlook() {
  const [steps, setSteps] = useState<OutlookStep[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchReplay()
      .then((r) => (r.outlook?.length ? setSteps(r.outlook) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="px-4 text-[15px] text-muted">The wind outlook is unavailable right now.</p>;
  if (!steps) return <div className="mx-4 h-64 animate-pulse rounded-3xl bg-line" aria-busy />;

  return (
    <div>
      <div className="px-4">
        <Lead step={steps[0]} />
      </div>
      <div className="no-scrollbar relative mt-3 flex gap-4 overflow-x-auto px-4 pb-1 lg:block lg:space-y-3 lg:overflow-visible">
        {byDay(steps).map((d) => (
          <div key={d.date} className="shrink-0 lg:shrink">
            <h3 className="mb-1.5 text-[15px] font-bold">{d.label}</h3>
            <ul className="flex gap-1.5 lg:grid lg:grid-cols-8">
              {d.steps.map((s) => (
                <Cell key={s.t} step={s} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 px-4 text-[13px] text-muted">{OUTLOOK_NOTE}</p>
    </div>
  );
}
