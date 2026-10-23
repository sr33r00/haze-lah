"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDateShort, fmtFullDate, fmtWeekday } from "@/lib/format";
import { loadDay, loadIndex } from "@/lib/historyClient";
import type { HistoryDay, HistoryIndex } from "@/lib/historyTypes";
import { NASA_AOD_URL } from "@/lib/links";
import { FIRE_COLOR, fetchReplay } from "@/lib/replay";
import { AOD_DAYS, AOD_MAX, AOD_STOPS, RELIEF, SAT_ASPECT, SAT_SIZE, aodDates, aodUrl } from "@/lib/satellite";
import { psiByDate } from "@/lib/timeline";
import type { DayPsi, Replay } from "@/lib/types";
import FullScreenPicture from "./FullScreenPicture";
import SmokeOverlay, { Key, LayerChips, SMOKE_LAYERS, type SmokeLayer } from "./SmokeOverlay";
import { useNearScreen } from "./useNearScreen";

const LAYERS = SMOKE_LAYERS.filter((l) => l.id !== "ahead"); // the chips: fires and labels; there is no smoke path for a past day
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
        className={`h-11 w-full ${onDark ? "accent-white" : "accent-[var(--accent)]"}`}
      />
      <div aria-hidden className={`flex justify-between text-[13px] ${onDark ? "text-white/70" : "text-muted"}`}>
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
      <div aria-hidden className="tabular relative mt-1 h-5 text-[13px] text-muted">
        {TICKS.map((v, i) => (
          <span key={v} className="absolute top-0" style={{ left: `${(v / AOD_MAX) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === TICKS.length - 1 ? "-100%" : "-50%"})` }}>
            {v === AOD_MAX ? `${v}+` : v}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "Smoke thickness": how much sunlight the smoke and haze block (NASA VIIRS Deep Blue aerosol optical depth, the three satellites stacked
 * so that they fill each other's gaps) over Sumatra, Singapore and Borneo for each of the last `AOD_DAYS` days, chosen with a slider, over
 * the relief map. Drawn over it: that day's fires (today's from the live replay, a past day's from its history file), the provinces with most of
 * them, and Singapore with that day's highest 24-hr PSI (`psiDaily`, the live NEA days, over the history index's). Nothing loads until the section is near the screen.
 */
export default function SmokeThickness({ psiDaily }: { psiDaily: DayPsi[] }) {
  const box = useRef<HTMLDivElement>(null);
  const near = useNearScreen(box);
  const [dates, setDates] = useState<string[] | null>(null); // computed in the browser: the server's page can be up to half an hour old
  const [sel, setSel] = useState(AOD_DAYS - 1); // today
  const [layers, setLayers] = useState<Partial<Record<SmokeLayer, boolean>>>({ fires: true, labels: true });
  const [replay, setReplay] = useState<Replay | null>(null);
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [files, setFiles] = useState<Record<string, HistoryDay | null>>({}); // a day's history file; null when it has none
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => setDates(aodDates()), []);
  useEffect(() => {
    if (!near) return;
    fetchReplay().then(setReplay, () => {});
    loadIndex().then(setIndex);
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
      <div ref={box} className="px-4">
        <div className="animate-pulse rounded-2xl bg-line" style={{ aspectRatio: SAT_ASPECT }} />
      </div>
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
    <p aria-live="polite" className="tabular min-h-12 text-[15px] font-bold sm:min-h-6">
      {caption}
    </p>
  );
  const withFires = (fires?.length ?? 0) > 0;

  return (
    <div ref={box} className="px-4">
      {captionEl}
      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
        <div>
          <FullScreenPicture
            name="Smoke thickness"
            disabled={!near}
            inline={
              <>
                {stack}
                {note ? <span className="absolute inset-0 grid place-items-center p-4 text-center text-[15px] text-white/80">{note}</span> : overlay}
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
          <p className="mt-1 text-[13px] text-muted">Blank patches are clouds or gaps between satellite passes. NASA posts the newest day or two late.</p>
        </div>
        <div className="mt-3 lg:mt-0">
          {withFires && <LayerChips shown={LAYERS} layers={layers} onToggle={(id) => setLayers((old) => ({ ...old, [id]: !old[id] }))} />}
          <h3 className="text-[13px] font-semibold text-fg">How to read this</h3>
          <div className="mt-1.5">
            <AodKey />
          </div>
          {layers.fires && withFires && (
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              <Key mark={<span className="size-2.5 rounded-full" style={{ background: FIRE_COLOR }} />}>Fire seen by NASA that day</Key>
            </ul>
          )}
          <p className="mt-2 text-[13px] text-muted">
            Aerosol optical depth: how much sunlight the smoke and haze block. Above about 1 is thick haze.{" "}
            <a href={NASA_AOD_URL} target="_blank" rel="noreferrer" className="text-accent underline">
              Source
            </a>
          </p>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted">Smoke: NASA VIIRS Deep Blue (NOAA-20, NOAA-21, Suomi NPP) via NASA GIBS · Fires: NASA FIRMS · PSI: NEA</p>
    </div>
  );
}
