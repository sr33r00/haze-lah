import { ChevronRight, Info, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, adviceStep, heroPaint, pm25Band, pm25Color, pm25ToUsAqi, psiLevel, verdictFor, type Group, type Region } from "@/lib/bands";
import { bestTimeLine, planSlot, planStrip } from "@/lib/exercise";
import { fromHour } from "@/lib/forecast";
import { fmtHour } from "@/lib/format";
import { GUIDE_AQICN_URL } from "@/lib/links";
import type { ForecastPoint, WeatherHour } from "@/lib/types";
import { cap } from "./ui";
import { usePlanChoice } from "./usePrefs";
import Counter from "./bits/Counter";
import { PuffStage } from "./PuffScene";
import WeatherTiles from "./WeatherTiles";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];
/** The chips' words: short enough to sit on one line on a phone. The full names (`GROUP_LABEL`) are what a screen reader hears. */
const GROUP_SHORT: Record<Group, string> = { healthy: "Healthy adult", sensitive: "Child, elderly, pregnant", chronic: "Heart or lung" };

// Wording follows the NEA haze advisory: 1-hr PM2.5 for the next few hours, 24-hr PSI for planning the day.
const EXPLAIN = {
  pm25: "This is the PM2.5 for the last hour, in µg/m³. PM2.5 is fine dust from smoke. Use this number to decide what to do now.",
  psi: "This is NEA's PSI, the average of the past 24 hours. Use this number to plan the day. Above 100 is unhealthy.",
} as const;

export default function Hero(props: {
  region: Region;
  now: number;
  weather: WeatherHour[];
  readingTime: string | null;
  pm25: number | null;
  psi: number | null;
  trend: string | null;
  group: Group;
  onGroup: (g: Group) => void;
  hourly: ForecastPoint[];
}) {
  const { pm25, psi, group } = props;
  const [open, setOpen] = useState<keyof typeof EXPLAIN | null>(null);
  const step = adviceStep(pm25, psi, group);
  const v = step != null ? verdictFor(step) : null;
  const { tone, ink, soft, bg, tray } = heroPaint(step);
  const next = fromHour(props.hourly, props.now).slice(0, 6);
  // The same activity, length and window as Plan your day, so the two always agree.
  const { activity, hours } = usePlanChoice();
  const slot = planSlot(props.hourly, planStrip(props.hourly, activity, group, props.now, props.weather), activity, group, props.now, hours, props.weather);
  const best = slot ? bestTimeLine(slot, activity, props.now) : null;

  return (
    <section
      id="now"
      className="relative mt-3 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-5 lg:mx-4 lg:rounded-[32px]"
      style={{ background: bg, color: ink, "--focus": ink } as React.CSSProperties}
    >
      <Link href="/glance" aria-label="Big screen view" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center" style={{ color: soft }}>
        <Maximize2 size={20} aria-hidden />
      </Link>
      <p className="pr-8 text-label" style={{ color: soft }}>
        {cap(props.region)}.{props.readingTime ? ` Measured at ${fmtHour(props.readingTime)}.` : ""} Should I go out?
      </p>
      <div className="flex items-center gap-3">
        <div key={`${props.region}-${group}-${v?.headline}`} className="relative z-10 min-w-0 flex-1 animate-rise">
          <h1 className="mt-1 text-balance text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em]">{v ? v.headline : "No reading yet."}</h1>
          <p className="mt-2 max-w-[34ch] text-[17px] leading-snug">{v ? v.detail : "NEA data is temporarily unavailable."}</p>
        </div>
        <PuffStage step={step} />
      </div>

      <div role="group" aria-label="Advice for" className="mt-5 grid gap-0.5 rounded-2xl p-0.5" style={{ gridTemplateColumns: "auto auto auto", background: tray }}>
        {GROUPS.map((g) => (
          <button
            key={g}
            aria-label={GROUP_LABEL[g]}
            aria-pressed={g === group}
            onClick={() => props.onGroup(g)}
            className="min-h-11 rounded-xl px-1 py-2 text-fine min-[380px]:whitespace-nowrap font-semibold leading-tight transition-colors"
            style={g === group ? { background: ink, color: tone ? tone.bg : "var(--surface)" } : { color: soft }}
          >
            {GROUP_SHORT[g]}
          </button>
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt>
            <button
              onClick={() => setOpen(open === "pm25" ? null : "pm25")}
              aria-expanded={open === "pm25"}
              aria-controls="explain"
              className="flex items-center gap-1 text-left text-label"
              style={{ color: soft }}
            >
              Right now
              <Info size={14} aria-hidden />
            </button>
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">
            {pm25 != null ? <Reading value={Math.round(pm25)} /> : "–"}
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-label font-semibold">
            {pm25 != null && <Dot color={pm25Color(pm25)} />}
            {pm25 != null ? pm25Band(pm25).name : ""}
          </dd>
          <dd className="text-label" style={{ color: soft }}>
            PM2.5, last hour{props.trend ? `. ${props.trend}` : ""}
          </dd>
        </div>
        <div>
          <dt>
            <button
              onClick={() => setOpen(open === "psi" ? null : "psi")}
              aria-expanded={open === "psi"}
              aria-controls="explain"
              className="flex items-center gap-1 text-left text-label"
              style={{ color: soft }}
            >
              Today&apos;s average
              <Info size={14} aria-hidden />
            </button>
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">
            {psi != null ? <Reading value={psi} /> : "–"}
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-label font-semibold">
            {psi != null && <Dot color={LEVEL_COLOR[psiLevel(psi)]} />}
            {psi != null ? LEVEL_NAME[psiLevel(psi)] : ""}
          </dd>
          <dd className="text-label" style={{ color: soft }}>
            PSI, past 24 hours
          </dd>
        </div>
      </dl>
      {pm25 != null && (
        // One small line, so the AQICN number reads as another site's scale, not as NEA's reading.
        <p className="mt-3 text-label" style={{ color: soft }}>
          <span className="tabular font-semibold">{pm25ToUsAqi(pm25)}</span> on AQICN (US scale) ·{" "}
          <Link href={GUIDE_AQICN_URL} className="-my-3.5 inline-block py-3.5 font-semibold link">
            Why?
          </Link>
        </p>
      )}
      <div aria-live="polite">
        {slot && best && (
          // Slightly stronger than the AQICN line above, and well under the numbers: a link down to Plan your day.
          <a href="#plan" className="group -mx-1 mt-3 flex min-h-11 items-center gap-2 px-1 leading-snug">
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{best.text}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-label" style={{ color: soft }}>
                <Dot color={pm25Color(slot.pm25)} />
                {best.detail}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" style={{ color: soft }} />
          </a>
        )}
      </div>
      <WeatherTiles region={props.region} now={props.now} weather={props.weather} />

      <p id="explain" hidden={!open} className="mt-3 text-label leading-snug" style={{ color: soft }}>
        {open && EXPLAIN[open]}
      </p>

      {next.length > 0 && (
        // A neutral panel, so the PM2.5 band colours stay visible on every verdict colour.
        <div className="mt-6 rounded-2xl bg-surface p-3 text-fg">
          <p className="mb-2 text-label text-muted">Next {next.length} hours, PM2.5 µg/m³, island-wide</p>
          <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${next.length}, minmax(0, 1fr))` }}>
            {next.map((p, i) => (
              <li key={p.time} className="text-center">
                <div
                  className="h-2.5 origin-bottom animate-grow rounded-full"
                  style={{ background: pm25Color(p.pm25), animationDelay: `${i * 60}ms` }}
                />
                <div className="tabular mt-1 text-label font-bold">{p.pm25}</div>
                <div className="text-label text-muted">{fmtHour(p.time)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Dot({ color }: { color: string }) {
  // White gap and a ring in the text colour, so the level colour shows on every verdict background.
  return <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: color, boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px currentColor" }} />;
}

/** A reading whose digits roll to the new value when the region or reading changes, so the change is visible. */
function Reading({ value }: { value: number }) {
  return <Counter value={value} fontSize="inherit" intro={false} duration={0.6} />;
}
