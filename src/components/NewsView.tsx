"use client";

import { ArrowUpRight, Bell } from "lucide-react";
import { useState } from "react";
import { LEVEL_NAME, LEVEL_TEXT, psiLevel } from "@/lib/bands";
import { ALERTS_URL } from "@/lib/links";
import { fmtTime, fmtWhen } from "@/lib/format";
import type { TimelineItem } from "@/lib/situation";
import type { Supporters } from "@/lib/types";
import { sgDate } from "@/lib/util";
import SupportCard from "./SupportCard";

const ADVISORIES = "https://www.nea.gov.sg/media/news/advisories";
const FILTERS: { label: string; sources: TimelineItem["source"][] | null }[] = [
  { label: "All", sources: null },
  { label: "NEA", sources: ["NEA"] },
  { label: "News", sources: ["CNA", "ST"] },
  { label: "Weather", sources: ["MSS"] },
  { label: "Live", sources: ["NEA readings", "NASA FIRMS"] },
];

const SOURCE_NAME: Record<TimelineItem["source"], string> = {
  NEA: "NEA",
  MSS: "Met Service",
  CNA: "CNA",
  ST: "Straits Times",
  "NEA readings": "Readings",
  "NASA FIRMS": "Fires",
};

/** Events worked out from the readings and fires, not published by anyone: shown small so the news reads clearly. */
const isDerived = (n: TimelineItem) => n.source === "NEA readings" || n.source === "NASA FIRMS";

/** Today is blue, yesterday dark, older days grey, so the feed shows at a glance how fresh each part is. */
const dayStyle = (key: string) => (key === sgDate(0) ? "bg-accent text-bg" : key === sgDate(-1) ? "bg-fg text-bg" : "bg-line text-muted");

function Derived({ n }: { n: TimelineItem }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="tabular w-14 shrink-0 text-[13px] text-muted">{n.hasHour ? fmtTime(n.time) : ""}</span>
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        <span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-muted align-middle" />
        <span className="font-semibold">{n.title}.</span> <span className="text-muted">{n.summary}</span>
      </p>
    </li>
  );
}

function Item({ n, i }: { n: TimelineItem; i: number }) {
  if (isDerived(n)) return <Derived n={n} />;
  const official = n.source === "NEA";
  return (
    <li className="relative flex animate-rise gap-3 px-4 py-4 active:bg-surface" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <span className="tabular w-14 shrink-0 pt-0.5 text-[13px] text-muted">{n.hasHour ? fmtTime(n.time) : ""}</span>
      <div className="min-w-0 flex-1">
        <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${official ? "bg-accent text-bg" : "bg-line"}`}>{SOURCE_NAME[n.source]}</span>
        <p className="mt-1.5 max-w-[70ch] text-[16px] font-bold leading-snug">
          {n.url ? (
            // The link covers the whole row, so the headline is the only link a screen reader hears.
            <a href={n.url} target="_blank" rel="noreferrer" className="after:absolute after:inset-0">
              {n.title}
              <ArrowUpRight size={15} aria-hidden className="ml-1 inline align-[-2px] text-muted" />
              <span className="sr-only"> (opens {new URL(n.url).hostname.replace(/^www\./, "")})</span>
            </a>
          ) : (
            n.title
          )}
        </p>
        {n.summary && <p className="mt-1 line-clamp-3 max-w-[75ch] text-[14px] leading-snug text-muted">{n.summary}</p>}
      </div>
    </li>
  );
}

/** The News tab: PSI status, source filter and day-grouped updates. */
export default function NewsView({ items, streak, psi, supporters }: { items: TimelineItem[]; streak: number; psi: { min: number; max: number } | null; supporters: Supporters | null }) {
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
    <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-x-8 lg:px-4">
      <div className="lg:sticky lg:top-[calc(4.5rem+env(safe-area-inset-top))] lg:col-start-2 lg:row-start-1 lg:space-y-4 lg:[&>*]:mx-0 lg:[&>*]:mt-0">
        {(streak > 0 || psi || ALERTS_URL) && (
          <div className="mx-4 flex items-center gap-3 rounded-3xl bg-surface p-4">
            <div className="min-w-0 flex-1">
              {streak > 0 && <p className="text-[20px] font-bold leading-tight">{streak >= 7 ? "7+ days of unhealthy air" : `Day ${streak} of unhealthy air`}</p>}
              {psi && lv != null && (
                <p className={`text-[15px] ${streak > 0 ? "mt-1 text-muted" : ""}`}>
                  24-hr PSI {psi.min === psi.max ? psi.max : `${psi.min}–${psi.max}`}, <b style={{ color: LEVEL_TEXT[lv] }}>{LEVEL_NAME[lv]}</b>
                </p>
              )}
            </div>
            {ALERTS_URL && (
              <a
                href={ALERTS_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Get haze alerts on Telegram"
                title="A Telegram message when the PSI band changes or NEA posts an update"
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-bg"
              >
                <Bell size={16} aria-hidden />
                Alerts
              </a>
            )}
          </div>
        )}

        <SupportCard supporters={supporters} className="hidden lg:block" />

        <div role="group" aria-label="Filter updates" className="mt-3 flex gap-1.5 px-4 lg:mt-0 lg:px-0">
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
              <h2 suppressHydrationWarning className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-bg px-4 py-2">
                <span suppressHydrationWarning className={`rounded-full px-3 py-1 text-[13px] font-bold ${dayStyle(d.key)}`}>
                  {d.label}
                </span>
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
