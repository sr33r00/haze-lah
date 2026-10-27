"use client";

import { Activity, ArrowUpRight, Bell, ChevronDown, Flame } from "lucide-react";
import { useState } from "react";
import { LEVEL_COLOR, LEVEL_NAME, LEVEL_TEXT, psiLevel } from "@/lib/bands";
import { ALERTS_URL } from "@/lib/links";
import { fmtDateShort, fmtTime, fmtWhen } from "@/lib/format";
import { latestNeaUpdate, type Outlook } from "@/lib/neaOutlook";
import type { Streak, TimelineItem } from "@/lib/situation";
import { sgDate } from "@/lib/util";

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

/** Source chips: NEA in an inked ring, Met Service on a soft tint, outlets neutral. */
const chipStyle = (source: TimelineItem["source"]) =>
  source === "NEA" ? "bg-line text-fg ring-1 ring-fg/40" : source === "MSS" ? "bg-line text-soft" : "bg-surface text-soft ring-1 ring-line";

/** The arrow and screen-reader note for a link that opens another site. */
function Outbound({ url }: { url: string }) {
  return (
    <>
      <ArrowUpRight size={15} aria-hidden className="ml-1 inline align-[-2px] text-muted" />
      <span className="sr-only"> (opens {new URL(url).hostname.replace(/^www\./, "")})</span>
    </>
  );
}

/** Time of day in the narrow column left of a row; empty when the source gave only a date. */
function Clock({ n }: { n: TimelineItem }) {
  return <span className="tabular w-[3.75rem] shrink-0 pt-[3px] text-label leading-tight text-muted">{n.hasHour ? fmtTime(n.time) : ""}</span>;
}

function Derived({ n }: { n: TimelineItem }) {
  const Icon = n.source === "NASA FIRMS" ? Flame : Activity;
  return (
    <li className="flex gap-3 px-4 py-3">
      <Clock n={n} />
      <p className="min-w-0 flex-1 text-label leading-snug text-muted">
        <Icon size={14} aria-hidden className="mr-1.5 inline align-[-2px]" />
        <span className="font-semibold text-soft">{n.title}.</span> {n.summary}
      </p>
    </li>
  );
}

function Item({ n, i }: { n: TimelineItem; i: number }) {
  if (isDerived(n)) return <Derived n={n} />;
  return (
    <li className="relative flex animate-rise gap-3 px-4 py-5 active:bg-surface" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <Clock n={n} />
      <div className="min-w-0 flex-1">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label font-semibold ${chipStyle(n.source)}`}>{SOURCE_NAME[n.source]}</span>
        <p className="mt-2 max-w-[70ch] text-pretty text-[17px] font-bold leading-[1.3]">
          {n.url ? (
            // The link covers the whole row, so the headline is the only link a screen reader hears.
            <a href={n.url} target="_blank" rel="noreferrer" className="after:absolute after:inset-0">
              {n.title}
              <Outbound url={n.url} />
            </a>
          ) : (
            n.title
          )}
        </p>
        {n.summary && <p className="mt-1.5 line-clamp-3 max-w-[75ch] text-body leading-[1.5] text-soft">{n.summary}</p>}
      </div>
    </li>
  );
}

/** NEA's latest Haze Situation Update as a card: the PSI range it expects, the band, when it was posted and the link. */
function NeaLatest({ item, outlook }: { item: TimelineItem; outlook: Outlook | null }) {
  const color = outlook ? LEVEL_TEXT[outlook.level] : undefined;
  const range = outlook?.min != null && outlook.max != null ? (outlook.min === outlook.max ? `${outlook.max}` : `${outlook.min}–${outlook.max}`) : null;
  return (
    <section aria-labelledby="nea-latest" className="mx-4 mt-3 rounded-3xl bg-surface p-4">
      <h2 id="nea-latest" suppressHydrationWarning className="text-label font-semibold text-muted">
        {outlook ? `NEA forecast · ${fmtDateShort(outlook.forDate)}` : "Latest from NEA"}
      </h2>
      {outlook ? (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {range && <span className="tabular text-[40px] font-extrabold leading-none">{range}</span>}
          <span className={`font-bold ${range ? "text-label" : "text-[24px] leading-tight"}`} style={{ color }}>
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: LEVEL_COLOR[outlook.level] }} />
            {outlook.band}
          </span>
        </p>
      ) : (
        item.summary && <p className="mt-1.5 line-clamp-3 text-body leading-[1.5] text-soft">{item.summary}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p suppressHydrationWarning className="text-label text-muted">
          Posted {fmtWhen(item.time, item.hasHour)}
        </p>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="-mr-2 flex min-h-[44px] items-center px-2 link text-label font-semibold">
            Full update
            <Outbound url={item.url} />
          </a>
        )}
      </div>
    </section>
  );
}

/** The News tab: PSI status, source filter and day-grouped updates. */
export default function NewsView({ items, streak, psi }: { items: TimelineItem[]; streak: Streak | null; psi: { min: number; max: number } | null }) {
  const [filter, setFilter] = useState(0);
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const allowed = FILTERS[filter].sources;
  // NEA's latest update gets its own card, so it is left out of the list: its link appears once.
  const latest = latestNeaUpdate(items);
  const rest = items.filter((i) => i !== latest?.item);
  const shown = allowed ? rest.filter((i) => allowed.includes(i.source)) : rest;

  const days: { key: string; label: string; items: TimelineItem[] }[] = [];
  for (const n of shown) {
    const key = sgDate(0, new Date(n.time));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(n);
    else days.push({ key, label: fmtWhen(n.time, false), items: [n] });
  }
  // Today and yesterday stay open. With neither, the newest day opens, and a tap flips any day that can be toggled.
  const [today, yesterday] = [sgDate(0), sgDate(-1)];
  const recent = (key: string) => key === today || key === yesterday;
  const noRecent = !days.some((d) => recent(d.key));
  const isOpen = (key: string, i: number) => recent(key) || (noRecent && i === 0) !== flipped.has(key);
  const flip = (key: string) =>
    setFlipped((f) => {
      const next = new Set(f);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const lv = psi ? psiLevel(psi.max) : null;
  return (
    <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-x-8 lg:px-4">
      <div className="lg:sticky lg:top-[calc(4.5rem+env(safe-area-inset-top))] lg:col-start-2 lg:row-start-1 lg:space-y-4 lg:[&>*]:mx-0 lg:[&>*]:mt-0">
        {(streak || psi || ALERTS_URL) && (
          <div className="mx-4 flex items-center gap-3 rounded-3xl bg-surface p-4">
            <div className="min-w-0 flex-1">
              {streak && (
                <p className="text-[20px] font-bold leading-tight">
                  {streak.days} {streak.days === 1 ? "day" : "days"} of haze <span className="whitespace-nowrap text-label font-normal text-muted">since {fmtDateShort(streak.since)}</span>
                </p>
              )}
              {psi && lv != null && (
                <p className={`text-label ${streak ? "mt-1 text-muted" : ""}`}>
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
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 btn-primary rounded-full px-4 text-label font-semibold"
              >
                <Bell size={16} aria-hidden />
                Alerts
              </a>
            )}
          </div>
        )}

        {latest && <NeaLatest item={latest.item} outlook={latest.outlook} />}

        <div role="group" aria-label="Filter updates" className="mt-3 flex gap-1 px-4 lg:mt-0 lg:px-0">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              aria-pressed={i === filter}
              onClick={() => {
                setFilter(i);
                setFlipped(new Set());
              }}
              className={`min-h-[44px] flex-auto rounded-full px-2 text-label font-semibold ${i === filter ? "bg-fg text-bg" : "border border-line bg-surface"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-start-1 lg:row-start-1">
        {days.length === 0 ? (
          <div className="px-4 pt-6 text-label">
            <p className="font-bold">No updates right now</p>
            <a href={ADVISORIES} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center link font-semibold">
              NEA advisories
            </a>
          </div>
        ) : (
          days.map((d, di) => {
            const open = isOpen(d.key, di);
            const label =
              d.key === today ? (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full bg-fg" />
                  {d.label}
                </span>
              ) : (
                d.label
              );
            return (
              <section key={d.key} className="mt-3">
                <h2 suppressHydrationWarning className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-line bg-bg">
                  {recent(d.key) ? (
                    <span suppressHydrationWarning className="flex min-h-[44px] items-center px-4 text-label font-bold">
                      {label}
                    </span>
                  ) : (
                    <button
                      aria-expanded={open}
                      aria-controls={`day-${d.key}`}
                      onClick={() => flip(d.key)}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-label font-bold"
                    >
                      <span suppressHydrationWarning className="min-w-0 flex-1">
                        {label}
                      </span>
                      <span className="tabular text-label font-normal text-muted">
                        {d.items.length} {d.items.length === 1 ? "update" : "updates"}
                      </span>
                      <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </h2>
                <ul id={`day-${d.key}`} hidden={!open} className="divide-y divide-line">
                  {d.items.map((n, i) => (
                    <Item key={`${n.time}-${n.title}-${i}`} n={n} i={i} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
