"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { LEVEL_NAME, LEVEL_TEXT, psiLevel } from "@/lib/bands";
import { ALERTS_URL } from "@/lib/links";
import { fmtTime, fmtWhen } from "@/lib/format";
import type { TimelineItem } from "@/lib/situation";
import { sgDate } from "@/lib/util";

const ADVISORIES = "https://www.nea.gov.sg/media/news/advisories";
const LONG = 140; // about three lines on a phone

const FILTERS: { label: string; sources: TimelineItem["source"][] | null }[] = [
  { label: "All", sources: null },
  { label: "NEA", sources: ["NEA"] },
  { label: "News", sources: ["CNA", "ST"] },
  { label: "Weather", sources: ["MSS"] },
  { label: "Live", sources: ["NEA readings", "NASA FIRMS"] },
];

function Item({ n, i }: { n: TimelineItem; i: number }) {
  const [open, setOpen] = useState(false);
  const long = n.summary.length > LONG;
  return (
    <li className="flex animate-rise gap-3 px-4 py-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <span className="tabular w-14 shrink-0 pt-0.5 text-[13px] text-muted">{n.hasHour ? fmtTime(n.time) : ""}</span>
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-line px-2 py-0.5 text-[12px] font-semibold">{n.source}</span>
        <p className="mt-1.5 text-[16px] font-bold leading-snug">{n.title}</p>
        {n.summary && <p className={`mt-1 text-[14px] leading-snug text-muted ${open ? "" : "line-clamp-3"}`}>{n.summary}</p>}
        <div className="flex flex-wrap gap-x-4">
          {long && (
            <button onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-[44px] text-[14px] font-semibold text-accent">
              {open ? "Less" : "More"}
            </button>
          )}
          {n.url && (
            <a
              href={n.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center text-[14px] font-semibold text-accent underline"
            >
              Read on {new URL(n.url).hostname.replace(/^www\./, "")}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/** The News tab: PSI status, source filter and day-grouped updates. */
export default function NewsView({ items, streak, psi }: { items: TimelineItem[]; streak: number; psi: { min: number; max: number } | null }) {
  const [filter, setFilter] = useState(0);
  const allowed = FILTERS[filter].sources;
  const shown = allowed ? items.filter((i) => allowed.includes(i.source)) : items;

  const days: { key: string; label: string; items: TimelineItem[] }[] = [];
  for (const n of shown) {
    const key = sgDate(0, new Date(n.time));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(n);
    else days.push({ key, label: fmtWhen(n.time, false), items: [n] });
  }

  const lv = psi ? psiLevel(psi.max) : null;
  return (
    <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-8 lg:px-4">
      <div className="lg:sticky lg:top-[calc(4.5rem+env(safe-area-inset-top))] lg:col-start-2 lg:row-start-1 lg:space-y-4 lg:[&>*]:mx-0 lg:[&>*]:mt-0">
        {(streak > 0 || psi) && (
          <div className="mx-4 rounded-3xl bg-surface p-4">
            {streak > 0 && <p className="text-[20px] font-bold">{streak >= 7 ? "7+ days of unhealthy air" : `Day ${streak} of unhealthy air`}</p>}
            {psi && lv != null && (
              <p className={`text-[15px] ${streak > 0 ? "mt-1 text-muted" : ""}`}>
                24-hr PSI {psi.min === psi.max ? psi.max : `${psi.min}–${psi.max}`}, <b style={{ color: LEVEL_TEXT[lv] }}>{LEVEL_NAME[lv]}</b>
              </p>
            )}
          </div>
        )}

        {ALERTS_URL && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-3xl bg-surface p-4">
            <Bell size={20} className="shrink-0 text-accent" aria-hidden />
            <p className="min-w-0 flex-1 text-[14px] leading-snug">
              <b>Get alerts on Telegram</b>
              <span className="text-muted"> — a message when the PSI band changes or NEA posts an update.</span>
            </p>
            <a
              href={ALERTS_URL}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-bg"
            >
              Join
            </a>
          </div>
        )}

        <div role="group" aria-label="Filter updates" className="flex gap-1.5 px-4 pt-4 lg:px-0 lg:pt-0">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              aria-pressed={i === filter}
              onClick={() => setFilter(i)}
              className={`min-h-[44px] min-w-0 flex-1 rounded-full px-1 text-[13px] font-semibold ${i === filter ? "bg-fg text-bg" : "border border-line bg-surface"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-start-1 lg:row-start-1">
        {days.length === 0 ? (
          <div className="px-4 pt-6 text-[15px]">
            <p className="font-bold">No updates right now</p>
            <a href={ADVISORIES} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center font-semibold text-accent underline">
              NEA advisories
            </a>
          </div>
        ) : (
          days.map((d) => (
            <section key={d.key} className="mt-2">
              <h2
                suppressHydrationWarning
                className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-bg px-4 py-2 text-[14px] font-bold text-muted"
              >
                {d.label}
              </h2>
              <ul className="divide-y divide-line">
                {d.items.map((n, i) => (
                  <Item key={`${n.time}-${n.title}-${i}`} n={n} i={i} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
