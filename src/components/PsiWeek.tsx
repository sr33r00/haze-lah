import { LEVEL_COLOR, LEVEL_NAME, psiLevel } from "@/lib/bands";
import { fmtDay } from "@/lib/format";
import { sgDate } from "@/lib/util";
import type { DayPsi } from "@/lib/types";

/** Peak 24-hr PSI for each of the last 7 days, as coloured bars. */
export default function PsiWeek({ days }: { days: DayPsi[] }) {
  if (!days.length) return <p className="px-4 text-[15px] text-muted">History is unavailable right now.</p>;
  const top = Math.max(200, ...days.map((d) => d.max));
  const summary = days.map((d) => `${d.date === sgDate(0) ? "Today" : fmtDay(d.date, 2)} ${d.max} ${LEVEL_NAME[psiLevel(d.max)]}`).join(", ");
  return (
    <ol aria-label={`Peak 24-hour PSI, last 7 days. ${summary}`} className="flex gap-2 px-4">
      {days.map((d) => (
        <li key={d.date} className="min-w-0 flex-1 text-center">
          <div className="tabular text-[13px] font-bold">{d.max}</div>
          <div className="flex h-24 items-end">
            <div className="w-full rounded-t-md" style={{ height: `${(d.max / top) * 100}%`, background: LEVEL_COLOR[psiLevel(d.max)] }} />
          </div>
          <div aria-hidden className="mt-1 text-[12px] text-muted">
            {d.date === sgDate(0) ? "Today" : fmtDay(d.date, 2)}
          </div>
        </li>
      ))}
    </ol>
  );
}
