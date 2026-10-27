"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDateShort, fmtFullDate, fmtWeekday } from "@/lib/format";
import { loadDay, loadIndex } from "@/lib/historyClient";
import type { HistoryDay, HistoryIndex } from "@/lib/historyTypes";
import { NASA_AOD_URL } from "@/lib/links";
import { FIRE_MARK } from "@/lib/replay";
import { AOD_DAYS, AOD_MAX, AOD_STOPS, RELIEF, SAT_SIZE, aodDates, aodUrl } from "@/lib/satellite";
import { psiByDate } from "@/lib/timeline";
import type { DayPsi, Replay } from "@/lib/types";
import FullScreenPicture, { PictureNote, PictureSkeleton } from "./FullScreenPicture";
import SmokeOverlay, { Key, hasLayer, type SmokeLayer } from "./SmokeOverlay";

const TICKS = [0, 0.5, 1, 2, AOD_MAX] as const; // the values the colour key names
const KEY_GRADIENT = `linear-gradient(to right, ${AOD_STOPS.map(([v, c]) => `${c} ${((v / AOD_MAX) * 100).toFixed(1)}%`).join(", ")})`;

/** The ground (`RELIEF`, so that gaps in the smoke show land) and under it the smoke thickness of every day, stacked so that choosing a day only swaps which one shows (`current`). Spans and images only, so it can sit inside a button. */
function Stack({ dates, current, load, onError }: { dates: string[]; current: string; load: boolean; onError: (date: string) => void }) {
  return (
    <span className="absolute inset-0">
      {/* eslint-disable @next/next/no-img-element */}
      <img src={RELIEF} alt="" width={SAT_SIZE.w} height={SAT_SIZE.h} className="absolute inset-0 size-full" />
      {load &&
        dates.map((d) => (
          <img
            key={d}
            src={aodUrl(d)}
            alt=""
            width={SAT_SIZE.w}
            height={SAT_SIZE.h}
            onError={() => onError(d)}
            className={`absolute inset-0 size-full ${d === current ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}

/** The day slider (a native range input: arrow keys step one day) with its first and last day named under it. `onDark` suits the black full-screen view. */
function DaySlider({ dates, sel, onSel, onDark = false }: { dates: string[]; sel: number; onSel: (i: number) => void; onDark?: boolean }) {
  const date = dates[sel];
  const today = sel === dates.length - 1;
  return (
    <div>
      <input
        type="range"
        min={0}
        max={dates.length - 1}
        step={1}
        value={sel}
        onChange={(e) => onSel(Number(e.target.value))}
        aria-label="Day"
        aria-valuetext={`${today ? "Today, " : ""}${fmtWeekday(date, "long")} ${fmtFullDate(date)}`}
        className={`h-11 w-full ${onDark ? "accent-white" : "accent-[var(--fg)]"}`}
      />
      <div aria-hidden className={`flex justify-between text-label ${onDark ? "text-white/70" : "text-muted"}`}>
        <span>{fmtDateShort(dates[0])}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** The colour key: NASA's aerosol optical depth palette from 0 to `AOD_MAX`, with ticks. */
function AodKey() {
  return (
    <div role="img" aria-label={`Colour scale of aerosol optical depth, from 0 in pale yellow to ${AOD_MAX} and above in dark red`}>
      <div className="h-3 rounded-full border border-fg/20" style={{ background: KEY_GRADIENT }} />
      <div aria-hidden className="tabular relative mt-1 h-5 text-fine text-muted">
        {TICKS.map((v, i) => (
          <span key={v} className="absolute top-0" style={{ left: `${(v / AOD_MAX) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === TICKS.length - 1 ? "-100%" : "-50%"})` }}>
            {v === AOD_MAX ? `${v}+` : v}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The key of the day slider: the colour scale, the fire line and what the thickness means, for the sidebar of "Smoke from space". */
export function WeekKey({ replay, layers }: { replay: Replay | null; layers: Record<SmokeLayer, boolean> }) {
  return (
    <>
      <div className="mt-1.5">
        <AodKey />
      </div>
      {layers.fires && hasLayer(replay, "fires") && (
        <ul className="mt-2 space-y-1.5 text-label text-muted">
          <Key mark={<span className="size-2.5 rounded-full" style={FIRE_MARK} />}>Fire seen by NASA that day</Key>
        </ul>
      )}
      <p className="mt-2 text-label text-muted">
        Aerosol optical depth: how much sunlight the smoke and haze block. Above about 1 is thick haze.{" "}
        <a href={NASA_AOD_URL} target="_blank" rel="noreferrer" className="link">
          Source
        </a>
      </p>
    </>
  );
}

/**
 * The "Last 7 days" view of "Smoke from space": how much sunlight the smoke and haze block (NASA VIIRS Deep Blue aerosol optical depth, the three satellites stacked
 * so that they fill each other's gaps) over Sumatra, Singapore and Borneo for each of the last `AOD_DAYS` days, chosen with a slider, over
 * the relief map. Drawn over it: that day's fires (today's from the live `replay`, a past day's from its history file), the provinces with most of
 * them, and Singapore with that day's highest 24-hr PSI (`psiDaily`, the live NEA days, over the history index's), as far as the `layers` are on. Nothing loads until `near`.
 */
export default function SmokeThickness({ psiDaily, replay, layers, near }: { psiDaily: DayPsi[]; replay: Replay | null; layers: Record<SmokeLayer, boolean>; near: boolean }) {
  const [dates, setDates] = useState<string[] | null>(null); // computed in the browser: the server's page can be up to half an hour old
  const [sel, setSel] = useState(AOD_DAYS - 1); // today
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [files, setFiles] = useState<Record<string, HistoryDay | null>>({}); // a day's history file; null when it has none
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => setDates(aodDates()), []);
  useEffect(() => {
    if (near) loadIndex().then(setIndex);
  }, [near]);

  const date = dates?.[sel];
  const today = dates?.at(-1);
  useEffect(() => {
    if (!near || !date || date === today) return;
    loadDay(date).then((d) => setFiles((old) => ({ ...old, [date]: d })));
  }, [near, date, today]);

  const psi = useMemo(() => psiByDate(index, psiDaily), [index, psiDaily]);

  if (!dates || !date) {
    return (
      <>
        <div aria-hidden className="min-h-[4.25rem] sm:min-h-6" />
        <div className="mt-2">
          <PictureSkeleton />
        </div>
      </>
    );
  }

  const live = replay?.days.find((d) => d.date === date);
  const file = files[date]; // undefined while it loads
  const fires = date === today ? live?.fires : file === undefined ? undefined : (file?.fires ?? live?.fires);
  const count = index?.days.find((d) => d.date === date)?.fires ?? live?.total ?? (file ? file.totals.sumatra + file.totals.borneo : undefined);
  const reading = psi.get(date) != null ? `24-hr PSI ${psi.get(date)}` : null;
  const caption = [date === today ? "Today (afternoon passes)" : fmtDateShort(date), reading, count != null && `${count.toLocaleString("en-SG")} fires`].filter(Boolean).join(" · ");
  const note = failed[date] ? "Smoke thickness is unavailable right now." : null;

  const stack = <Stack dates={dates} current={date} load={near} onError={(d) => setFailed((old) => ({ ...old, [d]: true }))} />;
  const overlay = <SmokeOverlay fires={fires ?? []} layers={layers} reading={reading} />;
  const captionEl = (
    <p aria-live="polite" className="tabular min-h-12 text-label font-bold sm:min-h-6">
      {caption}
    </p>
  );

  return (
    <>
      {captionEl}
      <div className="mt-2">
        <FullScreenPicture
          name="Smoke thickness"
          disabled={!near}
          inline={
            <>
              {stack}
              {note ? <PictureNote>{note}</PictureNote> : overlay}
            </>
          }
          full={
            <>
              {stack}
              {overlay}
            </>
          }
          chips={null}
          controls={
            <>
              <DaySlider dates={dates} sel={sel} onSel={setSel} onDark />
              {captionEl}
            </>
          }
        />
        <div className="mt-2">
          <DaySlider dates={dates} sel={sel} onSel={setSel} />
        </div>
        <p className="mt-1 text-label text-muted">Blank patches are clouds or gaps between satellite passes. NASA posts the newest day or two late.</p>
      </div>
    </>
  );
}
