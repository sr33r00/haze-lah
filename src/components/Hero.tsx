import { Info, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, STEP_TEXT, adviceStep, heroPaint, pm25Band, pm25Color, pm25ToUsAqi, psiLevel, verdictFor, type Group } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import { GUIDE_AQICN_URL } from "@/lib/links";
import type { ForecastPoint } from "@/lib/types";
import { cap } from "./ui";
import Counter from "./bits/Counter";
import { PuffStage } from "./PuffScene";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];
const GROUP_SHORT: Record<Group, string> = { healthy: "Healthy adult", sensitive: "Child, elderly, pregnant", chronic: "Heart or lung condition" };

// Wording follows the NEA haze advisory: 1-hr PM2.5 for the next few hours, 24-hr PSI for planning the day.
const EXPLAIN = {
  pm25: "This is the PM2.5 for the last hour, in µg/m³. PM2.5 is fine dust from smoke. Use this number to decide what to do now.",
  psi: "This is NEA's PSI, the average of the past 24 hours. Use this number to plan the day. Above 100 is unhealthy.",
} as const;

export default function Hero(props: {
  region: string;
  readingTime: string | null;
  pm25: number | null;
  psi: number | null;
  trend: string | null;
  group: Group;
  onGroup: (g: Group) => void;
  next: ForecastPoint[];
}) {
  const { pm25, psi, group } = props;
  const [open, setOpen] = useState<keyof typeof EXPLAIN | null>(null);
  const step = adviceStep(pm25, psi, group);
  const v = step != null ? verdictFor(step) : null;
  const { tone, ink, soft, bg } = heroPaint(step);

  return (
    <section
      id="now"
      className="relative mt-3 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-5 lg:mx-4 lg:rounded-[32px]"
      style={{ background: bg, color: ink }}
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

      <div role="group" aria-label="Advice for" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl p-1" style={{ background: `color-mix(in srgb, ${ink} 14%, transparent)` }}>
        {GROUPS.map((g) => (
          <button
            key={g}
            aria-pressed={g === group}
            onClick={() => props.onGroup(g)}
            className="rounded-xl px-1 py-2 text-label font-semibold leading-tight transition-colors"
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
        // A neutral panel with its own tag, so the AQICN number reads as another site's scale, not as NEA's reading.
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-surface px-3 py-2.5 text-fg">
          <span className="mt-px shrink-0 rounded-md bg-fg px-1.5 py-0.5 text-fine font-bold tracking-wide text-bg">ON AQICN</span>
          <p className="text-label leading-snug">
            This PM2.5 of <span className="tabular">{Math.round(pm25)}</span> shows as <b className="tabular font-bold">{pm25ToUsAqi(pm25)}</b>. AQICN uses a US scale, not the PSI.{" "}
            <Link href={GUIDE_AQICN_URL} className="-my-3.5 inline-block py-3.5 font-semibold text-accent underline">
              Why?
            </Link>
          </p>
        </div>
      )}
      <p id="explain" hidden={!open} className="mt-3 text-label leading-snug" style={{ color: soft }}>
        {open && EXPLAIN[open]}
      </p>

      {props.next.length > 0 && (
        // A neutral panel, so the PM2.5 band colours stay visible on every verdict colour.
        <div className="mt-6 rounded-2xl bg-surface p-3 text-fg">
          <p className="mb-2 text-label text-muted">Next {props.next.length} hours, PM2.5 µg/m³, island-wide</p>
          <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${props.next.length}, minmax(0, 1fr))` }}>
            {props.next.map((p, i) => (
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

      {step != null && (
        <p className="mt-5 text-label leading-snug" style={{ color: soft }}>
          NEA advice for {GROUP_LABEL[group].toLowerCase()}: {STEP_TEXT[step].toLowerCase()}.
        </p>
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
