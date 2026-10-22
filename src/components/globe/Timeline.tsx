"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { fmtMonth } from "@/lib/format";
import type { Bar, Mark } from "@/lib/timeline";
import PlayButton from "../PlayButton";

/** How many days the strip shows across its width; a longer timeline scrolls back. */
const VISIBLE_DAYS = 90;
/** Share of the strip's width a mark's label needs (fractions), under which two labels would touch. */
const LABEL_SHARE = 0.17;

const FORECAST_HATCH = "repeating-linear-gradient(135deg, rgba(251,191,119,0.85) 0 1.5px, transparent 1.5px 4px)";

type Props = {
  bars: Bar[];
  marks: Mark[];
  /** Index in `bars` of the selected day. */
  selected: number;
  /** The selected moment as text for the screen (`text`, e.g. "Thu 23 Oct, 3pm") and in full for the slider (`full`). */
  readout: { text: string; full: string; tag: string | null };
  /** Frames are on their way. */
  busy: boolean;
  playing: boolean;
  onPick: (bar: number) => void;
  onNudge: (unit: "day" | "step", dir: 1 | -1) => void;
  onEdge: (end: "first" | "last") => void;
  onPlay: () => void;
  className?: string;
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * The globe's timeline: a play button, the selected moment as text, and one bar per day (fires, hatched where only a forecast
 * exists, faint where there is no record) with event marks. A slider: drag across the strip, or use the arrow keys
 * (one day; with Shift one step). Newest on the right; a strip longer than VISIBLE_DAYS scrolls back.
 */
export default function Timeline({ bars, marks, selected, readout, busy, playing, onPick, onNudge, onEdge, onPlay, className = "" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const n = bars.length;
  const most = Math.max(1, ...bars.map((b) => b.fires ?? 0));

  // Keep the selected day in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || n < 2) return;
    const w = el.scrollWidth / n;
    const x = selected * w;
    if (x < el.scrollLeft) el.scrollLeft = x - 3 * w;
    else if (x + w > el.scrollLeft + el.clientWidth) el.scrollLeft = x + 4 * w - el.clientWidth;
  }, [selected, n]);

  /** The bar under a pointer; a bar with no record stands for the nearest one that has. */
  const pick = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || !n) return;
    const at = clamp(Math.floor(((clientX - box.left) / box.width) * n), 0, n - 1);
    for (let d = 0; d < n; d++) {
      const i = [at + d, at - d].find((j) => j >= 0 && j < n && bars[j].source !== "none");
      if (i != null) return onPick(i);
    }
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    pick(e.clientX);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const box = e.currentTarget.getBoundingClientRect(); // a drag towards either edge scrolls the strip
    if (e.clientX < box.left + 24) e.currentTarget.scrollLeft -= 10;
    else if (e.clientX > box.right - 24) e.currentTarget.scrollLeft += 10;
    pick(e.clientX);
  };
  const key = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (dir) onNudge(e.shiftKey ? "step" : "day", dir);
    else if (e.key === "Home") onEdge("first");
    else if (e.key === "End") onEdge("last");
    else return;
    e.preventDefault();
  };

  const at = (i: number) => ((i + 0.5) / n) * 100;
  // Each label runs away from its tick, to the left on the right half of the strip. A label close to the one before it takes the other
  // side if there is room, else a second row.
  const labels: { label: string; i: number; left: boolean; row: number }[] = [];
  for (const m of marks) {
    const i = bars.findIndex((b) => b.date === m.date);
    if (i < 0) continue;
    const prev = labels.at(-1);
    let left = at(i) > 55;
    let row = 0;
    if (prev && Math.abs(at(i) - at(prev.i)) < LABEL_SHARE * 100 && prev.row === 0) {
      left = !prev.left;
      if (left ? at(i) < LABEL_SHARE * 100 : at(i) > (1 - LABEL_SHARE) * 100) {
        left = prev.left;
        row = 1;
      }
    }
    labels.push({ label: m.label, i, left, row });
  }
  const rows = labels.some((l) => l.row) ? 2 : 1;
  const today = bars.findIndex((b) => b.kind === "today");

  return (
    <section aria-label="Timeline" className={`px-4 pb-2.5 pt-0.5 ${className}`}>
      <div className="flex items-center gap-3">
        <PlayButton playing={playing} loading={busy && playing} onClick={onPlay} what="the timeline" className="bg-white text-[#02030a]" />
        <div aria-live="polite" aria-atomic="true" className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold leading-6 tabular">
            {readout.text}
            {readout.tag && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 align-[1px] text-[11px] font-semibold uppercase tracking-wide text-white/85">{readout.tag}</span>}
          </p>
        </div>
      </div>

      <div
        ref={scroller}
        role="slider"
        tabIndex={0}
        aria-label="Day"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={Math.max(0, selected)}
        aria-valuetext={readout.full}
        aria-orientation="horizontal"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={key}
        className="no-scrollbar mt-1.5 cursor-ew-resize touch-none overflow-x-auto overscroll-x-contain rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <div ref={track} className="relative select-none" style={{ width: n > VISIBLE_DAYS ? `${(n / VISIBLE_DAYS) * 100}%` : "100%" }}>
          {/* Event marks */}
          <div aria-hidden className="relative" style={{ height: rows * 16 }}>
            {labels.map(({ label, i, left, row }) =>
              i < 0 ? null : (
                <span key={label} className="absolute flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold leading-4 text-white/85" style={{ left: `${at(i)}%`, top: row * 16, transform: left ? "translateX(-100%)" : undefined, flexDirection: left ? "row-reverse" : "row" }}>
                  <span className="size-0 border-x-4 border-t-[5px] border-x-transparent border-t-white/85" style={{ marginInline: left ? "0 -4px" : "-4px 0" }} />
                  {label}
                </span>
              ),
            )}
          </div>
          {/* Bars */}
          <div aria-hidden className="flex h-12 items-end min-[700px]:h-16">
            {bars.map((b, k) => {
              const forecast = b.kind === "forecast";
              const gap = b.source === "none";
              const h = gap ? 6 : forecast ? 34 : b.fires ? Math.max(8, Math.sqrt(b.fires / most) * 100) : 3;
              return (
                <div key={b.date} className={`flex h-full min-w-0 flex-1 items-end justify-center rounded-[3px] px-[0.5px] ${k === selected ? "bg-white/20 ring-1 ring-white/80" : ""}`}>
                  <div
                    className={`w-full min-w-[2px] rounded-t-[1.5px] ${gap ? "bg-white/20" : forecast ? "" : b.kind === "today" ? "bg-amber-200" : "bg-orange-500"}`}
                    style={{ height: `${h}%`, minHeight: 2, backgroundImage: forecast ? FORECAST_HATCH : undefined }}
                  />
                </div>
              );
            })}
          </div>
          {/* Months, and today */}
          <div aria-hidden className="relative mt-1 h-3.5 text-[11px] leading-[14px] text-white/65">
            {bars.map((b, k) =>
              b.date.endsWith("-01") && k > 0 && k < n - 2 ? (
                <span key={b.date} className="absolute" style={{ left: `${(k / n) * 100}%` }}>
                  {fmtMonth(b.date)}
                </span>
              ) : null,
            )}
            {today >= 0 && (
              <span className="absolute -translate-x-full font-semibold text-white/90" style={{ left: `${((today + 1) / n) * 100}%` }}>
                Today
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
