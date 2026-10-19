import { ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import Link from "next/link";
import { LEVEL_COLOR, psiLevel } from "@/lib/bands";
import { fmtDay } from "@/lib/format";
import { hazeTrend } from "@/lib/trend";
import type { DayOutlook } from "@/lib/types";

const ICON = { better: TrendingDown, worse: TrendingUp, same: Minus, clear: Minus };

/** "Is it getting better?": one sentence from the coming days' expected peak PSI, and those days as a colour strip. */
export default function HazeOutlook({ days, psiNow }: { days: DayOutlook[]; psiNow: number | null }) {
  const t = hazeTrend(days, psiNow);
  if (!t) return null;
  const Icon = ICON[t.tone];
  return (
    <Link href="/forecast" className="group mx-4 mt-3 block rounded-3xl bg-surface p-4 transition-colors hover:bg-line/60">
      <span className="flex items-start gap-2.5">
        <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-snug first-letter:uppercase">{t.text}</span>
          {t.rain && <span className="block text-[13px] text-muted">{t.rain}</span>}
        </span>
        <ChevronRight size={18} aria-hidden className="mt-0.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d, k) => (
          <span key={d.date} className="text-center">
            <span className="block h-1.5 rounded-full" style={{ background: LEVEL_COLOR[psiLevel(d.psiMax)] }} />
            <span className="mt-1 block text-[11px] text-muted">{fmtDay(d.date, k)}</span>
            <span className="tabular block text-[13px] font-semibold">{d.psiMax}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">Expected peak 24-hour PSI by day. Open the forecast.</span>
    </Link>
  );
}
