"use client";

import { useState } from "react";
import { fmtWhen } from "@/lib/format";
import type { TimelineItem } from "@/lib/situation";

const SHOWN = 6;

/** Vertical timeline of official updates and events derived from the readings. */
export default function NewsTimeline({ items, streak }: { items: TimelineItem[]; streak: number }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="px-4 text-[15px] text-muted">No updates right now.</p>;
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <div className="px-4">
      {streak > 0 && (
        <p className="mb-3 text-[17px] font-bold">{streak >= 7 ? "7+ days of unhealthy air" : `Day ${streak} of unhealthy air`}</p>
      )}
      <ol className="border-l-2 border-line">
        {shown.map((n, i) => (
          <li key={`${n.time}-${n.title}-${i}`} className="relative pb-5 pl-5 last:pb-0">
            <span aria-hidden className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-bg bg-fg" />
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span>{fmtWhen(n.time, n.hasHour)}</span>
              <span className="rounded-full bg-line px-2 py-0.5 font-semibold text-fg">{n.source}</span>
            </div>
            <p className="mt-1 text-[16px] font-bold leading-snug">{n.title}</p>
            {n.summary && <p className="mt-0.5 text-[14px] leading-snug text-muted">{n.summary}</p>}
            {n.url && (
              <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-accent underline">
                Read on {new URL(n.url).hostname.replace(/^www\./, "")}
              </a>
            )}
          </li>
        ))}
      </ol>
      {!all && items.length > SHOWN && (
        <button onClick={() => setAll(true)} className="mt-4 rounded-full bg-line px-4 py-2 text-[14px] font-semibold">
          Show more
        </button>
      )}
    </div>
  );
}
