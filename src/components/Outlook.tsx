"use client";

import { CloudRain } from "lucide-react";
import { useState } from "react";
import { LEVEL_TEXT, pm25Color, psiLevel, verdict, type Group } from "@/lib/bands";
import { fmtDay } from "@/lib/format";
import type { DayOutlook } from "@/lib/types";

/** "Rain 94% · 3 mm · gusts 45 km/h": the chance, the day's total and its strongest gust, as far as known. */
const rainText = (d: DayOutlook) =>
  [`Rain ${d.rainProb}%`, d.rainMm != null && (d.rainMm < 1 ? "<1 mm" : `${Math.round(d.rainMm)} mm`), d.gustMax != null && `gusts ${d.gustMax} km/h`].filter(Boolean).join(" · ");

const PARTS = ["Morning", "Afternoon", "Evening"];

/** One row per day: morning/afternoon/evening strip, advice, expected PSI; peak and chance of high PM2.5 on request. */
export default function Outlook({ days, group }: { days: DayOutlook[]; group: Group }) {
  const [open, setOpen] = useState(false);
  if (!days.length) return <p className="px-4 text-[15px] text-muted">The forecast is not available right now.</p>;
  return (
    <div className="px-4">
      <ul className="divide-y divide-line rounded-3xl bg-surface px-4">
        {days.map((d, i) => {
          const lv = psiLevel(d.psiMax);
          return (
            <li key={d.date} className="grid grid-cols-[3.6rem_1fr_auto] items-center gap-x-3 py-3.5">
              <div className="text-[15px] font-bold">{fmtDay(d.date, i)}</div>
              <div>
                <div className="flex gap-1" role="img" aria-label={PARTS.map((p, k) => `${p} ${d.parts[k] ?? "no data"}`).join(", ")}>
                  {d.parts.map((p, k) => (
                    <span
                      key={k}
                      className="h-2.5 flex-1 rounded-full"
                      style={{ background: p != null ? pm25Color(p) : "var(--line)" }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 text-[14px] font-semibold">
                  {verdict(lv, group).headline.replace(".", "")}
                  {d.rainProb != null && d.rainProb >= 40 && (
                    <span className="block text-[13px] font-normal text-muted">
                      <CloudRain size={13} aria-hidden className="mr-1 inline align-[-2px]" />
                      {rainText(d)}
                    </span>
                  )}
                </div>
              </div>
              <div className="tabular text-right text-[17px] font-bold" style={{ color: LEVEL_TEXT[lv] }}>
                PSI {d.psiMax}
              </div>
              {open && (
                <div className="col-span-3 mt-1 text-[12px] text-muted">
                  Peak hour {d.low === d.high ? d.high : `${d.low}–${d.high}`} µg/m³, {Math.round(d.pHigh * 100)}% chance above 55
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-1 flex min-h-[44px] items-center px-1 text-[13px] font-semibold text-accent"
      >
        {open ? "Hide details" : "Show details"}
      </button>
      {open && <p className="px-1 text-[12px] text-muted">Strips show morning, afternoon and evening. Peak is the likely range of the day&apos;s highest hour. Rain is the day&apos;s total; gusts are the strongest at 10 m above ground.</p>}
    </div>
  );
}
