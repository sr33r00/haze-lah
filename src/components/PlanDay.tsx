"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import { PM25_BANDS, TONE_COLOR, type Group } from "@/lib/bands";
import { BREATH_SOURCES, fmtDust } from "@/lib/breath";
import { CIGARETTE_SOURCES } from "@/lib/cigarettes";
import { ACTIVITIES, ACTIVITY, DURATIONS, PLAN_NOTES, RAIN_TEXT, bestSlots, isOk, planStrip, ratingLegend, slotReason, type Activity, type Slot } from "@/lib/exercise";
import { cap, fmtHour, fmtHourRange, fmtTimeRange } from "@/lib/format";
import { UV_SOURCES } from "@/lib/outdoor";
import type { ForecastPoint, WeatherHour } from "@/lib/types";
import { sgHour } from "@/lib/util";
import InfoNote from "./InfoNote";
import { useStored } from "./usePrefs";

const DURATION_KEYS = DURATIONS.map(String);
const durationLabel = (h: number) => (h < 1 ? `${h * 60} min` : `${h} h`);
// SGT is a whole-hour offset, so UTC minutes are local minutes: a 1.5 h session ends on the half hour.
const fmtSlot = (s: Slot) => (new Date(s.end).getUTCMinutes() ? fmtTimeRange : fmtHourRange)(s.start, s.end);

/** "0.7 cigarettes", or "under 0.1" when it rounds to nothing. */
const cigText = (n: number) => (n < 0.1 ? "under 0.1" : `${n} ${n === 1 ? "cigarette" : "cigarettes"}`);

/** A native select dressed as a chip, for use inside a sentence. The page-background fill sets it apart from the card it sits in. */
function ChipSelect({ label, value, options, onChange }: { label: string; value: string; options: [value: string, text: string][]; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-flex max-w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] max-w-full cursor-pointer appearance-none rounded-full bg-bg py-2 pl-4 pr-10 text-[17px] font-semibold text-fg"
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

/** The answer: which day, the time range and how the air rates then. */
function Answer({ slot }: { slot: Slot }) {
  return (
    <>
      <p className="text-label font-semibold uppercase tracking-wide text-muted">
        {cap(slot.day)} · {isOk(slot.rating) ? "Best time" : "Mildest time"}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="tabular text-[28px] font-bold leading-tight">{fmtSlot(slot)}</p>
        <p className="flex items-center gap-2 text-label font-semibold">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[slot.rating.tone].bg }} />
          {slot.rating.text}
        </p>
      </div>
      <p className="mt-1 text-label text-muted">{slotReason(slot)}</p>
    </>
  );
}

/** A forecast figure as text, or "Unavailable" when the weather forecast has none. */
const unless = (n: number | null, text: (n: number) => string) => (n == null ? "Unavailable" : text(n));

/** The numbers behind the answer. */
function Stats({ slot }: { slot: Slot }) {
  const stats = [
    ["PM2.5", `about ${Math.round(slot.pm25)}`],
    ["Dust breathed", fmtDust(slot.dustUg)],
    ["Like smoking", cigText(slot.cigarettes)],
    ["Vs a normal day", `${slot.timesNormal.toFixed(1)}×`],
    ["Rain chance", unless(slot.rainProb, (n) => `${Math.round(n)}%`)],
    ["Feels like", unless(slot.feelsLike, (n) => `${Math.round(n)}°`)],
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {stats.map(([name, value]) => (
        <div key={name}>
          <dt className="text-label text-muted">{name}</dt>
          <dd className="tabular text-label font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The smallest top of the strip's scale (PM2.5), so a flat clean day is not drawn tall. */
const MIN_TOP = 60;

/**
 * Pick what you want to do and for how long, in one card: the next cleanest time (today, or tomorrow once today is over),
 * the coming hours as a strip with it outlined, the numbers behind it and a forecast caveat. `now` (see `useNow`) is the time to plan from.
 */
export default function PlanDay({ hourly, weather, group, now }: { hourly: ForecastPoint[]; weather: WeatherHour[]; group: Group; now: number }) {
  const [activity, choose] = useStored<Activity>("activity", ACTIVITIES, "out");
  const usual = ACTIVITY[activity].hours;
  const [chosen, chooseLength] = useStored(`duration-${activity}`, DURATION_KEYS, String(usual));
  const len = Number(chosen);

  if (!hourly.length) return <p className="px-4 text-label text-muted">Forecast unavailable.</p>;
  const hours = planStrip(hourly, activity, group, now, weather);
  // Only the next window, and only inside the strip's hours: further ahead the forecast is less sure.
  const until = hours.length ? Date.parse(hours[0].time) + hours.length * 3600_000 : 0;
  const slot = bestSlots(hourly.filter((p) => Date.parse(p.time) < until), activity, group, now, len, weather)[0];
  const n = hours.length;
  const pct = (i: number) => `${(i / n) * 100}%`;
  // Bar height is PM2.5, on a scale that fits the tallest bar (never below MIN_TOP); NEA band I's top is marked when in range.
  const top = Math.max(MIN_TOP, ...hours.map((h) => h.pm25 * 1.1));
  const bandI = PM25_BANDS[0].max;
  // The first bar after SGT midnight starts tomorrow; with no earlier bar there is nothing to divide.
  const midnight = hours.findIndex((h, i) => i > 0 && sgHour(h.time) === 0);
  const outline = (() => {
    const start = slot ? hours.findIndex((h) => h.time === slot.start) : -1;
    return slot && start >= 0 ? { left: pct(start), width: pct(Math.min((Date.parse(slot.end) - Date.parse(slot.start)) / 3600_000, n - start)) } : null;
  })();

  return (
    <div className="mx-4 rounded-3xl bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[17px]">
        <span>I want to</span>
        <ChipSelect label="Activity" value={activity} options={ACTIVITIES.map((a) => [a, ACTIVITY[a].phrase])} onChange={(v) => choose(v as Activity)} />
        <span className="inline-flex items-center gap-x-2">
          for
          <ChipSelect label="How long" value={String(len)} options={DURATIONS.map((d) => [String(d), d === usual ? `${durationLabel(d)} (usual)` : durationLabel(d)])} onChange={chooseLength} />
        </span>
      </div>

      <div aria-live="polite" className="mt-4">
        {slot ? <Answer slot={slot} /> : <p className="text-label text-muted">No forecast for these hours yet.</p>}
      </div>

      {n > 0 && (
        <div className="mt-4 pr-6">
          <div aria-hidden className="relative h-4 text-fine font-semibold text-muted">
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
              aria-label={`Next ${n} hours to ${ACTIVITY[activity].phrase}${activity === "play" ? "" : `, for ${group === "healthy" ? "healthy adults" : "your group"}`}: ${hours.map((h) => `${fmtHour(h.time)} ${h.rating.text}${h.rainy && h.rating.text !== RAIN_TEXT ? ", rain likely" : ""}`).join(", ")}`}
              className="flex h-16 items-end gap-px"
            >
              {hours.map((h, i) => (
                <li key={h.time} className="flex h-full min-w-0 flex-1 items-end">
                  <div
                    className="w-full origin-bottom animate-grow rounded-t-sm"
                    style={{ height: `${Math.max(12, (h.pm25 / top) * 100)}%`, background: TONE_COLOR[h.rating.tone].bg, animationDelay: `${i * 20}ms` }}
                    title={`${fmtHour(h.time)}: PM2.5 ${Math.round(h.pm25)}${h.rainProb != null ? `, rain ${Math.round(h.rainProb)}%` : ""}`}
                  />
                </li>
              ))}
            </ol>
            {/* Hours with rain likely, one thin mark under each bar. It hangs below the strip, so it adds no height. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full mt-0.5 flex h-1 gap-px">
              {hours.map((h) => (
                <span key={h.time} className={`min-w-0 flex-1 rounded-full ${h.rainy ? "bg-accent" : ""}`} />
              ))}
            </div>
            {bandI < top && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted/60" style={{ bottom: `${(bandI / top) * 100}%` }}>
                <span className="absolute left-full top-0 -translate-y-1/2 pl-1 text-fine leading-none text-muted">{bandI}</span>
              </div>
            )}
            {outline && (
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-2 -top-1 rounded-md border-2 border-fg transition-[left,width] duration-300 motion-reduce:transition-none"
                style={outline}
              />
            )}
            {midnight > 0 && <div aria-hidden className="pointer-events-none absolute -top-4 bottom-0 w-px bg-muted" style={{ left: pct(midnight) }} />}
          </div>
          <div aria-hidden className="relative mt-3 h-4 text-fine text-muted">
            {hours.map((h, i) =>
              sgHour(h.time) % 6 === 0 && i > 0 && i < n - 1 ? (
                <span key={h.time} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(i + 0.5) }}>
                  {fmtHour(h.time)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {slot && <Stats slot={slot} />}

      {n > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted">
          {ratingLegend(activity, group).map((r) => (
            <li key={r.text} className="flex items-center gap-1.5">
              {r.tones.map((t) => (
                <span key={t} aria-hidden className="size-2.5 rounded-sm" style={{ background: TONE_COLOR[t].bg }} />
              ))}
              {r.text === RAIN_TEXT && <span aria-hidden className="h-1 w-3 rounded-full bg-accent" />}
              {r.text}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <p className="flex gap-2 text-label text-muted">
          <TriangleAlert aria-hidden size={16} className="mt-px shrink-0" />
          <span>This is a forecast and may be wrong. Winds can change suddenly, and the haze changes with them.</span>
        </p>
        <InfoNote lead={<span>How the best time is worked out</span>}>
          {PLAN_NOTES.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {[...CIGARETTE_SOURCES, ...BREATH_SOURCES, ...UV_SOURCES].map(([name, url]) => (
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
