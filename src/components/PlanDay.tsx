"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import { TONE_COLOR, type Group } from "@/lib/bands";
import { BREATH_SOURCES, fmtDust } from "@/lib/breath";
import { CIGARETTE_SOURCES } from "@/lib/cigarettes";
import { ACTIVITIES, ACTIVITY, DURATIONS, PLAN_NOTES, bestSlots, isOk, planStrip, ratingLegend, type Activity, type Slot } from "@/lib/exercise";
import { cap, fmtHour, fmtHourRange, fmtTimeRange } from "@/lib/format";
import type { ForecastPoint } from "@/lib/types";
import { sgHour } from "@/lib/util";
import InfoNote from "./InfoNote";
import { useStored } from "./usePrefs";

const DURATION_KEYS = DURATIONS.map(String);
const durationLabel = (h: number) => (h < 1 ? `${h * 60} min` : `${h} h`);
// SGT is a whole-hour offset, so UTC minutes are local minutes: a 1.5 h session ends on the half hour.
const fmtSlot = (s: Slot) => (new Date(s.end).getUTCMinutes() ? fmtTimeRange : fmtHourRange)(s.start, s.end);

/** "0.7 cigarettes", or "under 0.1" when it rounds to nothing. */
const cigText = (n: number) => (n < 0.1 ? "under 0.1" : `${n} ${n === 1 ? "cigarette" : "cigarettes"}`);

/** A native select dressed as a chip, for use inside a sentence. */
function ChipSelect({ label, value, options, onChange }: { label: string; value: string; options: [value: string, text: string][]; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-flex max-w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] max-w-full cursor-pointer appearance-none rounded-full bg-surface py-2 pl-4 pr-10 text-[17px] font-semibold text-fg"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </span>
  );
}

/** One day's answer: the time, the advice and the four numbers behind it. */
function AnswerCard({ slot }: { slot: Slot }) {
  const ok = isOk(slot.rating);
  const stats = [
    ["PM2.5", `about ${Math.round(slot.pm25)}`],
    ["Dust breathed", fmtDust(slot.dustUg)],
    ["Like smoking", cigText(slot.cigarettes)],
    ["Vs a normal day", `${slot.timesNormal.toFixed(1)}×`],
  ];
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        {cap(slot.day)} · {ok ? "Best time" : "Least hazy time"}
      </p>
      <p className="tabular mt-1 text-[22px] font-bold leading-tight">
        {fmtSlot(slot)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[slot.rating.tone].bg }} />
        {slot.rating.text}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {stats.map(([name, value]) => (
          <div key={name}>
            <dt className="text-[11px] text-muted">{name}</dt>
            <dd className="tabular text-[15px] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Pick what you want to do and for how long; get the next cleanest time (today, or tomorrow once today is over), and the coming hours as a strip with it outlined. */
export default function PlanDay({ hourly, group }: { hourly: ForecastPoint[]; group: Group }) {
  const [activity, choose] = useStored<Activity>("activity", ACTIVITIES, "out");
  const usual = ACTIVITY[activity].hours;
  const [chosen, chooseLength] = useStored(`duration-${activity}`, DURATION_KEYS, String(usual));
  const len = Number(chosen);

  if (!hourly.length) return <p className="px-4 text-[15px] text-muted">Forecast unavailable.</p>;
  const now = Date.now();
  const hours = planStrip(hourly, activity, group, now);
  // Only the next window, and only inside the strip's hours: further ahead the forecast is less sure.
  const until = hours.length ? Date.parse(hours[0].time) + hours.length * 3600_000 : 0;
  const slots = bestSlots(hourly.filter((p) => Date.parse(p.time) < until), activity, group, now, len).slice(0, 1);
  const n = hours.length;
  const pct = (i: number) => `${(i / n) * 100}%`;
  // Bar height is PM2.5, on a scale that always reaches NEA band III (150).
  const top = Math.max(150, ...hours.map((h) => h.pm25));
  // The first bar after SGT midnight starts tomorrow; with no earlier bar there is nothing to divide.
  const midnight = hours.findIndex((h, i) => i > 0 && sgHour(h.time) === 0);
  const outlines = slots.flatMap((s) => {
    const start = hours.findIndex((h) => h.time === s.start);
    return start < 0 ? [] : [{ day: s.day, left: pct(start), width: pct(Math.min((Date.parse(s.end) - Date.parse(s.start)) / 3600_000, n - start)) }];
  });

  return (
    <div className="px-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[17px]">
        <span>I want to</span>
        <ChipSelect label="Activity" value={activity} options={ACTIVITIES.map((a) => [a, ACTIVITY[a].phrase])} onChange={(v) => choose(v as Activity)} />
        <span className="inline-flex items-center gap-x-2">
          for
          <ChipSelect label="How long" value={String(len)} options={DURATIONS.map((d) => [String(d), d === usual ? `${durationLabel(d)} (usual)` : durationLabel(d)])} onChange={chooseLength} />
        </span>
      </div>

      <div aria-live="polite" className="mt-3">
        {slots.length === 0 ? (
          <p className="text-[15px] text-muted">No forecast for these hours yet.</p>
        ) : (
          <AnswerCard slot={slots[0]} />
        )}
      </div>
      <p className="mt-2 flex gap-2 text-[13px] text-muted">
        <TriangleAlert aria-hidden size={16} className="mt-px shrink-0" />
        <span>This is a forecast and may be wrong. Winds can change suddenly, and the haze changes with them.</span>
      </p>

      {n > 0 && (
        <div className="mt-4">
          <div aria-hidden className="relative h-4 text-[11px] font-semibold text-muted">
            {/* "Now" needs about a tenth of the strip before the Tomorrow label. */}
            {(midnight < 0 || midnight / n >= 0.1) && <span className="absolute left-0">Now</span>}
            {/* Near the right edge the label would run past the strip; the divider still shows. */}
            {midnight > 0 && midnight < n - 4 && (
              <span className="absolute pl-1" style={{ left: pct(midnight) }}>
                Tomorrow
              </span>
            )}
          </div>
          <div className="relative">
            <ol
              aria-label={`Next ${n} hours to ${ACTIVITY[activity].phrase}${activity === "play" ? "" : `, for ${group === "healthy" ? "healthy adults" : "your group"}`}: ${hours.map((h) => `${fmtHour(h.time)} ${h.rating.text}`).join(", ")}`}
              className="flex h-12 items-end gap-px"
            >
              {hours.map((h, i) => (
                <li key={h.time} className="flex h-full min-w-0 flex-1 items-end">
                  <div
                    className="w-full origin-bottom animate-grow rounded-t-sm"
                    style={{ height: `${Math.max(12, (h.pm25 / top) * 100)}%`, background: TONE_COLOR[h.rating.tone].bg, animationDelay: `${i * 20}ms` }}
                    title={`${fmtHour(h.time)}: PM2.5 ${Math.round(h.pm25)}`}
                  />
                </li>
              ))}
            </ol>
            {outlines.map((o) => (
              <div
                key={o.day}
                aria-hidden
                className="pointer-events-none absolute -bottom-1 -top-1 rounded-md border-2 border-fg transition-[left,width] duration-300 motion-reduce:transition-none"
                style={{ left: o.left, width: o.width }}
              />
            ))}
            {midnight > 0 && <div aria-hidden className="pointer-events-none absolute -top-4 bottom-0 w-px bg-muted" style={{ left: pct(midnight) }} />}
          </div>
          <div aria-hidden className="relative mt-1 h-4 text-[11px] text-muted">
            {hours.map((h, i) =>
              sgHour(h.time) % 6 === 0 && i > 0 && i < n - 1 ? (
                <span key={h.time} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(i + 0.5) }}>
                  {fmtHour(h.time)}
                </span>
              ) : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {ratingLegend(activity, group).map((r) => (
              <li key={r.text} className="flex items-center gap-1.5">
                {r.tones.map((t) => (
                  <span key={t} aria-hidden className="size-2.5 rounded-sm" style={{ background: TONE_COLOR[t].bg }} />
                ))}
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-1">
        <InfoNote lead={<span>How the best time is worked out</span>}>
          {PLAN_NOTES.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {[...CIGARETTE_SOURCES, ...BREATH_SOURCES].map(([name, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="underline">
                {name}
              </a>
            ))}
          </p>
        </InfoNote>
      </div>
    </div>
  );
}
