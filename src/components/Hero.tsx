import { Info, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, STEP_TEXT, TONE_COLOR, adviceStep, pm25Band, pm25Color, psiLevel, verdictFor, type Group } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint } from "@/lib/types";
import SkyScene from "./SkyScene";
import { cap } from "./ui";
import { useCountUp } from "./useCountUp";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];
const GROUP_SHORT: Record<Group, string> = { healthy: "Healthy adult", sensitive: "Child, elderly, pregnant", chronic: "Heart or lung condition" };

// Wording follows the NEA haze advisory: 1-hr PM2.5 for the next few hours, 24-hr PSI for planning the day.
const EXPLAIN = {
  pm25: "The last hour's fine smoke particles. NEA advises using it to decide what to do in the next few hours.",
  psi: "Singapore's official index over the past day. Use it to plan the day; above 100 is unhealthy.",
} as const;

const sgHour = (t: string | null) =>
  Number(new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", hour: "numeric", hourCycle: "h23" }).format(t ? new Date(t) : new Date()));

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
  const hour = sgHour(props.readingTime);
  const night = hour < 7 || hour >= 19;
  const ink = night ? "#eef2f4" : "#1d2226";
  const soft = night ? "rgba(238, 242, 244, 0.8)" : "rgba(29, 34, 38, 0.78)";

  return (
    <section id="now" className="relative mt-3 overflow-hidden lg:mx-4 lg:rounded-2xl">
      {/* Bottom padding (a share of the width) keeps the text above the buildings at every size. */}
      <div className="relative px-5 pb-[58%] pt-5" style={{ color: ink }}>
        <SkyScene pm25={pm25} night={night} />
        <div className="relative pr-16">
          <p className="text-[15px]" style={{ color: soft }}>
            {cap(props.region)}
            {props.readingTime ? `, ${fmtHour(props.readingTime)}` : ""}. Should I go out?
          </p>
          <div key={`${props.region}-${group}-${v?.headline}`} className="animate-rise">
            <h1 className="mt-1 text-balance text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em]">{v ? v.headline : "No reading yet."}</h1>
            {v && <div className="mt-3 h-1.5 w-14 rounded-full" style={{ background: TONE_COLOR[v.tone].bg }} />}
            <p className="mt-3 max-w-[30ch] text-[17px] leading-snug">{v ? v.detail : "NEA data is temporarily unavailable."}</p>
          </div>
        </div>
        <Link href="/glance" aria-label="Big screen view" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center" style={{ color: soft }}>
          <Maximize2 size={20} aria-hidden />
        </Link>
      </div>
      <div className="h-2.5" style={{ background: v ? TONE_COLOR[v.tone].bg : "var(--line)" }} />

      <div className="px-5 pb-6">
        <div role="group" aria-label="Advice for" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              aria-pressed={g === group}
              onClick={() => props.onGroup(g)}
              className={`rounded-xl px-1 py-2 text-[13px] font-semibold leading-tight transition-colors ${g === group ? "bg-fg text-bg" : "text-muted"}`}
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
                className="flex items-center gap-1 text-left text-[13px] text-muted"
              >
                PM2.5 now, 1-hour
                <Info size={14} aria-hidden />
              </button>
            </dt>
            <dd className="tabular mt-1 text-[48px] font-bold leading-none tracking-tight">
              <span aria-hidden>{pm25 != null ? pm : "–"}</span>
              {pm25 != null && <span className="sr-only">{Math.round(pm25)}</span>}
            </dd>
            <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
              {pm25 != null && <Dot color={pm25Color(pm25)} />}
              {pm25 != null ? `${pm25Band(pm25).name}, band ${pm25Band(pm25).band}` : ""}
            </dd>
            <dd className="text-[12px] text-muted">µg/m³{props.trend ? `, ${props.trend.toLowerCase()}` : ""}</dd>
          </div>
          <div>
            <dt>
              <button
                onClick={() => setOpen(open === "psi" ? null : "psi")}
                aria-expanded={open === "psi"}
                aria-controls="explain"
                className="flex items-center gap-1 text-left text-[13px] text-muted"
              >
                PSI, 24-hour
                <Info size={14} aria-hidden />
              </button>
            </dt>
            <dd className="tabular mt-1 text-[48px] font-bold leading-none tracking-tight">
              <span aria-hidden>{psi != null ? psiShown : "–"}</span>
              {psi != null && <span className="sr-only">{psi}</span>}
            </dd>
            <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
              {psi != null && <Dot color={LEVEL_COLOR[psiLevel(psi)]} />}
              {psi != null ? LEVEL_NAME[psiLevel(psi)] : ""}
            </dd>
            <dd className="text-[12px] text-muted">for planning the day</dd>
          </div>
        </dl>
        <p id="explain" hidden={!open} className="mt-3 text-[13px] leading-snug text-muted">
          {open && EXPLAIN[open]}
        </p>

        {props.next.length > 0 && (
          <div className="mt-6 rounded-2xl bg-surface p-3">
            <p className="mb-2 text-[13px] text-muted">Next {props.next.length} hours, PM2.5 µg/m³, island-wide</p>
            <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${props.next.length}, minmax(0, 1fr))` }}>
              {props.next.map((p, i) => (
                <li key={p.time} className="text-center">
                  <div className="h-2.5 origin-bottom animate-grow rounded-full" style={{ background: pm25Color(p.pm25), animationDelay: `${i * 60}ms` }} />
                  <div className="tabular mt-1 text-[15px] font-bold">{p.pm25}</div>
                  <div className="text-[11px] text-muted">{fmtHour(p.time)}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {step != null && (
          <p className="mt-5 text-[13px] leading-snug text-muted">
            NEA advice for {GROUP_LABEL[group].toLowerCase()}: {STEP_TEXT[step].toLowerCase()}.
          </p>
        )}
      </div>
    </section>
  );
}

function Dot({ color }: { color: string }) {
  // A page-coloured gap and a faint ring, so light level colours (yellow) still read on the page background.
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full"
      style={{ background: color, boxShadow: "0 0 0 2px var(--bg), 0 0 0 3px color-mix(in srgb, var(--fg) 35%, transparent)" }}
    />
  );
}
