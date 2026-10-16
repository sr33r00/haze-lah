import { Info, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, STEP_TEXT, TONE_COLOR, adviceStep, pm25Band, pm25Color, psiLevel, verdictFor, type Group } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint } from "@/lib/types";
import { cap } from "./ui";
import { useCountUp } from "./useCountUp";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];
const GROUP_SHORT: Record<Group, string> = { healthy: "Healthy adult", sensitive: "Child, elderly, pregnant", chronic: "Heart or lung condition" };

// Wording follows the NEA haze advisory: 1-hr PM2.5 for the next few hours, 24-hr PSI for planning the day.
const EXPLAIN = {
  pm25: "The last hour's fine smoke particles. NEA advises using it to decide what to do in the next few hours.",
  psi: "Singapore's official index over the past day. Use it to plan the day; above 100 is unhealthy.",
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
  const pm = useCountUp(pm25 != null ? Math.round(pm25) : null);
  const psiShown = useCountUp(psi);
  // Solid verdict colour with a subtle same-hue shade; neutral when there is no reading.
  const tone = v ? TONE_COLOR[v.tone] : null;
  const ink = tone ? tone.fg : "var(--fg)";
  const soft = `color-mix(in srgb, ${ink} 80%, transparent)`;
  const bg = tone ? `linear-gradient(180deg, ${tone.bg}, color-mix(in srgb, ${tone.bg} 88%, black))` : "var(--surface)";

  return (
    <section
      id="now"
      className="relative mt-3 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-5"
      style={{ background: bg, color: ink }}
    >
      <Link href="/glance" aria-label="Big screen view" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center" style={{ color: soft }}>
        <Maximize2 size={20} aria-hidden />
      </Link>
      <p className="pr-8 text-[15px]" style={{ color: soft }}>
        {cap(props.region)}
        {props.readingTime ? `, ${fmtHour(props.readingTime)}` : ""}. Should I go out?
      </p>
      <div key={`${props.region}-${group}-${v?.headline}`} className="animate-rise">
        <h1 className="mt-1 text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em]">{v ? v.headline : "No reading yet."}</h1>
        <p className="mt-2 max-w-[34ch] text-[17px] leading-snug">{v ? v.detail : "NEA data is temporarily unavailable."}</p>
      </div>

      <div role="radiogroup" aria-label="Advice for" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl p-1" style={{ background: `color-mix(in srgb, ${ink} 14%, transparent)` }}>
        {GROUPS.map((g) => (
          <button
            key={g}
            role="radio"
            aria-checked={g === group}
            onClick={() => props.onGroup(g)}
            className="rounded-xl px-1 py-2 text-[13px] font-semibold leading-tight transition-colors"
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
              className="flex items-center gap-1 text-left text-[13px]"
              style={{ color: soft }}
            >
              PM2.5 now, 1-hour
              <Info size={14} aria-hidden />
            </button>
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">
            <span aria-hidden>{pm25 != null ? pm : "–"}</span>
            {pm25 != null && <span className="sr-only">{Math.round(pm25)}</span>}
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
            {pm25 != null && <Dot color={pm25Color(pm25)} />}
            {pm25 != null ? `${pm25Band(pm25).name}, band ${pm25Band(pm25).band}` : ""}
          </dd>
          <dd className="text-[12px]" style={{ color: soft }}>
            µg/m³{props.trend ? `, ${props.trend.toLowerCase()}` : ""}
          </dd>
        </div>
        <div>
          <dt>
            <button
              onClick={() => setOpen(open === "psi" ? null : "psi")}
              aria-expanded={open === "psi"}
              aria-controls="explain"
              className="flex items-center gap-1 text-left text-[13px]"
              style={{ color: soft }}
            >
              PSI, 24-hour
              <Info size={14} aria-hidden />
            </button>
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">
            <span aria-hidden>{psi != null ? psiShown : "–"}</span>
            {psi != null && <span className="sr-only">{psi}</span>}
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
            {psi != null && <Dot color={LEVEL_COLOR[psiLevel(psi)]} />}
            {psi != null ? LEVEL_NAME[psiLevel(psi)] : ""}
          </dd>
          <dd className="text-[12px]" style={{ color: soft }}>
            for planning the day
          </dd>
        </div>
      </dl>
      <p id="explain" hidden={!open} className="mt-3 text-[13px] leading-snug" style={{ color: soft }}>
        {open && EXPLAIN[open]}
      </p>

      {props.next.length > 0 && (
        // A neutral panel, so the PM2.5 band colours stay visible on every verdict colour.
        <div className="mt-6 rounded-2xl bg-surface p-3 text-fg">
          <p className="mb-2 text-[13px] text-muted">Next {props.next.length} hours, island-wide forecast</p>
          <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${props.next.length}, minmax(0, 1fr))` }}>
            {props.next.map((p, i) => (
              <li key={p.time} className="text-center">
                <div
                  className="h-2.5 origin-bottom animate-grow rounded-full"
                  style={{ background: pm25Color(p.pm25), animationDelay: `${i * 60}ms` }}
                />
                <div className="tabular mt-1 text-[15px] font-bold">{p.pm25}</div>
                <div className="text-[11px] text-muted">{fmtHour(p.time)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {step != null && (
        <p className="mt-5 text-[13px] leading-snug" style={{ color: soft }}>
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
