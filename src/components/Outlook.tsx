import { CloudRain } from "lucide-react";
import { LEVEL_NAME, LEVEL_TEXT, pm25Color, psiLevel, verdict, type Group } from "@/lib/bands";
import { fmtDay } from "@/lib/format";
import type { DayOutlook } from "@/lib/types";
import InfoNote from "./InfoNote";

const PARTS = ["Morning", "Afternoon", "Evening"];

/** One row per day: morning/afternoon/evening strip, peak range, chance of high PM2.5, expected PSI. */
export default function Outlook({ days, group }: { days: DayOutlook[]; group: Group }) {
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
                <div className="flex gap-1" aria-label={PARTS.map((p, k) => `${p} ${d.parts[k] ?? "no data"}`).join(", ")}>
                  {d.parts.map((p, k) => (
                    <span
                      key={k}
                      className="h-2.5 flex-1 rounded-full"
                      style={{ background: p != null ? pm25Color(p) : "var(--line)" }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 text-[13px] text-muted">
                  Peak <span className="tabular font-semibold text-fg">{d.low === d.high ? d.high : `${d.low}–${d.high}`}</span> µg/m³
                  {d.rainProb != null && d.rainProb >= 40 && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <CloudRain size={13} aria-hidden />
                      {d.rainProb}%
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-[17px] font-bold" style={{ color: LEVEL_TEXT[lv] }}>
                  PSI {d.psiMax}
                </div>
                <div className="text-[12px] text-muted">{verdict(lv, group).headline.replace(".", "")}</div>
              </div>
              <div className="col-span-3 mt-1 text-[12px] text-muted">
                {Math.round(d.pHigh * 100)}% chance PM2.5 goes above 55, {LEVEL_NAME[lv].toLowerCase()} by 24-hour PSI
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 px-1">
        <InfoNote>
          <p>Strips show morning, afternoon and evening. Peak is the likely range of the day&apos;s highest hour.</p>
        </InfoNote>
      </div>
    </div>
  );
}
