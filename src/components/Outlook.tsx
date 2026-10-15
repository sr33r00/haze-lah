import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, psiLevel, verdict, type Group } from "@/lib/bands";
import { fmtDay } from "@/lib/format";
import type { DayOutlook } from "@/lib/types";
import { Card } from "./ui";

export default function Outlook({ days, group }: { days: DayOutlook[]; group: Group }) {
  if (!days.length) return null;
  return (
    <Card title="5-day outlook">
      <div className="grid grid-cols-5 gap-2 text-center">
        {days.map((d, i) => {
          const lv = psiLevel(d.psiMax);
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-muted">{fmtDay(d.date, i)}</span>
              <span className="grid h-11 w-11 place-items-center rounded-full text-lg" style={{ background: LEVEL_COLOR[lv] }}>
                <span aria-hidden>{verdict(lv, group).emoji}</span>
              </span>
              <span className="tabular text-sm font-bold">{d.psiMax}</span>
              <span className="text-[10px] leading-tight text-muted">{LEVEL_NAME[lv]}</span>
              {d.rainProb != null && d.rainProb >= 40 && <span className="text-[10px] text-sky-500">🌧 {d.rainProb}%</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Peak 24-hr PSI expected each day. Icons show advice for: {GROUP_LABEL[group].toLowerCase()}.</p>
    </Card>
  );
}
