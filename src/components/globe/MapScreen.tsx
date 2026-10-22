"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDateShort, fmtFullDate, fmtHour, fmtTime, fmtWeekday } from "@/lib/format";
import type { HistoryDay, HistoryIndex } from "@/lib/history";
import { loadDay, loadIndex, prefetchAround } from "@/lib/historyClient";
import { POLLUTANTS } from "@/lib/pollutants";
import { readingDots, type DotData } from "@/lib/readings";
import { fetchReplay, fetchSmoke } from "@/lib/replay";
import { buildBars, eventMarks, moveDay, moveStep, nearestStep, playNext, psiByDate, selectAt, stepsOf, type Bar, type Sel } from "@/lib/timeline";
import type { DayPsi, Replay, SmokeGrid } from "@/lib/types";
import { sgDate, sgHour } from "@/lib/util";
import AirGlobeLoader from "./AirGlobeLoader";
import { captionOf } from "./caption";
import { globeDay, type GlobeDay, type LayerChoice } from "./frame";
import GlobeCard from "./GlobeCard";
import Timeline from "./Timeline";

type Props = {
  dots: DotData;
  psiDaily: DayPsi[];
  /** Today in a few sentences: read by screen readers and crawlers, and shown if the globe cannot run. */
  summary: string[];
};

/** The layers a viewer can pick, in order: each CAMS pollutant, NASA's smoke picture, none. */
const LAYERS: { id: LayerChoice; label: string; name: string }[] = [
  ...POLLUTANTS.map((p) => ({ id: p.id, label: p.label, name: p.label })),
  { id: "smoke", label: "Smoke", name: "Smoke, from satellite" },
  { id: "off", label: "Off", name: "No colour layer" },
];

const EMPTY_REPLAY: Replay = { lats: [], lons: [], days: [] };
const EMPTY_SMOKE: SmokeGrid = { lats: [], lons: [], times: [], values: [], gases: {}, wind: null };
/** Milliseconds one step stays on screen while playing. */
const STEP_MS = 650;
/** Waiting before a past day's files are fetched, so that dragging across the strip does not fetch every day it passes. */
const SETTLE_MS = 120;
/** Days before the shown one that the globe dims in. */
const DIM_DAYS = 4;
/** The globe's panels: dark whatever the site theme, glass over the picture. */
const PANEL = "bg-[#070b16]/85 backdrop-blur-md";
/** From the tablet width up the card and the timeline are two panels side by side (Tailwind needs these class names whole). */
const SIDE_PANEL = "min-[700px]:rounded-2xl min-[700px]:border min-[700px]:border-white/10 min-[700px]:bg-[#070b16]/85 min-[700px]:backdrop-blur-md";

const chip = "grid h-11 shrink-0 place-items-center rounded-full border px-4 text-[14px] font-semibold transition-colors";

type History = { date: string; day: HistoryDay | null; before: HistoryDay[] };

const nonNull = <T,>(x: T | null): x is T => x != null;

/** A past day's file and the days before it (for the dim fires and the new zones). The loads are shared per date. */
async function loadHistory(date: string): Promise<History> {
  const prior = [...Array(DIM_DAYS).keys()].map((k) => sgDate(k - DIM_DAYS, new Date(`${date}T12:00:00+08:00`)));
  const [day, ...before] = await Promise.all([loadDay(date), ...prior.map((d) => loadDay(d))]);
  return { date, day, before: before.filter(nonNull) };
}

/**
 * The /map screen: the air globe with the layer picker on top and the card and timeline at the bottom. It loads the live replay and
 * smoke forecast (shared with the rest of the site) and the history index, then a past day's file only when that day is shown.
 */
export default function MapScreen({ dots: dotData, psiDaily, summary }: Props) {
  const [today] = useState(() => sgDate());
  const [layer, setLayer] = useState<LayerChoice>("pm25");
  const [view, setView] = useState<"default" | "path">("default");
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [smoke, setSmoke] = useState<SmokeGrid | null>(null);
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hist, setHist] = useState<History | null>(null);
  const [shown, setShown] = useState<GlobeDay>();

  useEffect(() => {
    // "?view=path" (the link from Now) frames the air's path; any other query, and the old "#space" anchor, the default view.
    if (new URLSearchParams(location.search).get("view") === "path") setView("path");
    fetchReplay().then(setReplay, () => setReplay(EMPTY_REPLAY));
    fetchSmoke().then(setSmoke, () => setSmoke(EMPTY_SMOKE));
    loadIndex().then(setIndex);
  }, []);

  // The days. A past day that the index lists has a history file, and with it 8 steps.
  const bars = useMemo(() => (replay && smoke ? buildBars(index, replay, smoke, today) : []), [index, replay, smoke, today]);
  const marks = useMemo(() => eventMarks(index, psiDaily), [index, psiDaily]);
  const psi = useMemo(() => psiByDate(index, psiDaily), [index, psiDaily]);
  const indexed = useMemo(() => new Set(index?.days.map((d) => d.date)), [index]);
  const hasFile = useCallback((b: Bar) => b.kind === "past" && indexed.has(b.date), [indexed]);
  const stepsFor = useCallback((b: Bar) => (smoke ? stepsOf(hasFile(b) ? { ...b, source: "history" } : b, smoke) : []), [smoke, hasFile]);

  // The first selection: today, at the step nearest now.
  useEffect(() => {
    const t = bars.find((b) => b.kind === "today");
    if (!sel && t) setSel({ date: t.date, step: nearestStep(stepsFor(t), Date.now()) });
  }, [bars, sel, stepsFor]);

  const at = sel ? bars.findIndex((b) => b.date === sel.date) : -1;
  const bar = bars[at] as Bar | undefined;
  const steps = bar ? stepsFor(bar) : [];
  const iso = sel ? steps[sel.step] : undefined;
  const date = sel?.date;
  const wantFile = bar != null && hasFile(bar);

  // The selected past day's files, after a pause while the viewer is still dragging.
  useEffect(() => {
    if (!wantFile || !date) return;
    let live = true;
    const t = setTimeout(() => loadHistory(date).then((h) => live && setHist(h)), playing ? 0 : SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [wantFile, date, playing]);
  const ready = !wantFile || hist?.date === date;

  // The globe's day: kept as it was while the next one's files come.
  const fresh = useMemo(
    () => (sel && bar && ready ? globeDay({ history: hist?.date === sel.date ? (hist.day ?? undefined) : undefined, before: hist?.before, replay: replay ?? undefined, smoke: smoke ?? undefined }, sel.date, sel.step, layer, today) : null),
    [sel, bar, ready, hist, replay, smoke, layer, today],
  );
  useEffect(() => {
    if (fresh) setShown(fresh);
  }, [fresh]);
  const blank = useMemo(() => globeDay({}, today, 0, "off", today), [today]);
  const day = shown ?? blank;

  const dots = useMemo(() => readingDots(dotData, layer, day.kind === "today"), [dotData, layer, day.kind]);

  // Playing: the next step after a pause, once its files are here.
  useEffect(() => {
    if (!playing || !sel) return;
    let live = true;
    const t = setTimeout(async () => {
      const next = playNext(bars, stepsFor, sel);
      const nb = next && bars.find((b) => b.date === next.date);
      if (!next || !nb) return setPlaying(false);
      if (hasFile(nb)) await loadHistory(next.date);
      if (live) setSel(next);
    }, STEP_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [playing, sel, bars, stepsFor, hasFile]);
  useEffect(() => {
    if (playing && date) prefetchAround(date, bars.filter(hasFile).map((b) => b.date));
  }, [playing, date, bars, hasFile]);

  const hour = sgHour(iso ?? Date.now());
  const go = (to: Sel | null) => {
    if (!to) return;
    setPlaying(false);
    setSel(to);
  };
  const play = () => {
    if (playing || !sel) return setPlaying(false);
    if (!playNext(bars, stepsFor, sel)) {
      const first = bars.slice(-90).find((b) => stepsFor(b).length); // at the end: from the start of the strip
      if (first) setSel(selectAt(first, stepsFor(first), hour));
    }
    setPlaying(true);
  };

  const live = useMemo(() => {
    if (!replay || day.kind === "forecast") return undefined;
    return replay.days.find((d) => d.date === day.date) ?? (day.kind === "today" ? replay.days.at(-1) : undefined);
  }, [replay, day.date, day.kind]);
  const barOfDay = bars.find((b) => b.date === day.date);
  const { headline, facts } = captionOf({ day, layer, live, fires: barOfDay?.fires ?? null, psi: psi.get(day.date) });

  const gone = (id: LayerChoice) => id !== "pm25" && POLLUTANTS.some((p) => p.id === id) && smoke != null && !smoke.gases?.[id as keyof SmokeGrid["gases"]];
  const readout = {
    text: sel ? `${fmtDateShort(sel.date)}${iso ? `, ${fmtHour(iso)}` : ""}` : "",
    full: sel ? `${fmtWeekday(sel.date, "long")} ${fmtFullDate(sel.date)}${iso ? `, ${fmtTime(iso)}` : ""}` : "",
    tag: !ready ? "Loading" : bar?.kind === "today" ? "Today" : bar?.kind === "forecast" ? "Forecast" : null,
  };

  const summaryBlock = (
    <section aria-label="Summary" className={failed ? "mx-auto max-w-xl space-y-3 px-6 pb-12 pt-6 text-[16px] leading-6" : "sr-only"}>
      <h1 className={failed ? "text-[26px] font-extrabold leading-8" : ""}>Air over Singapore and the region today</h1>
      {failed && <p className="text-white/70">The globe needs WebGL, which this device or browser does not give. Here is the air today in words.</p>}
      {summary.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {failed && facts.length > 0 && <p>{facts.join(". ")}.</p>}
    </section>
  );

  const back = (
    <Link href="/" aria-label="Back to Haze Lah" className={`${chip} ${PANEL} min-[700px]:gap-2 min-[700px]:px-4 w-11 border-white/15 text-white hover:bg-white/10 min-[700px]:w-auto`}>
      <span className="flex items-center gap-2">
        <ArrowLeft size={18} aria-hidden />
        <span className="hidden min-[700px]:inline">Haze Lah</span>
      </span>
    </Link>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02030a] text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[1100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-[#02030a]">
        Skip to content
      </a>
      {failed ? (
        <>
          <div className="px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">{back}</div>
          <main id="main" tabIndex={-1} className="size-full overflow-y-auto outline-none">
            {summaryBlock}
          </main>
        </>
      ) : (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-[#02030a]/70 to-transparent px-3 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="pointer-events-auto">{back}</div>
            <div role="group" aria-label="Colour layer" className={`no-scrollbar pointer-events-auto flex min-w-0 gap-1.5 overflow-x-auto rounded-full ${PANEL} border border-white/15 p-0.5 max-[699px]:[mask-image:linear-gradient(to_right,#000_85%,transparent)]`}>
              {LAYERS.map(({ id, label, name }) => {
                const off = gone(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={off}
                    aria-pressed={layer === id}
                    aria-label={off ? `${name}, not available now` : name}
                    title={off ? "Not available now" : undefined}
                    onClick={() => setLayer(id)}
                    className={`${chip} border-transparent ${layer === id ? "bg-white text-[#02030a]" : "text-white/85 hover:bg-white/10"} ${off ? "opacity-35" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </header>

          <main id="main" tabIndex={-1} className="absolute inset-0 outline-none">
            {summaryBlock}
            <AirGlobeLoader day={day} layer={layer} satDate={sel?.date ?? today} dots={dots} view={view} onFail={() => setFailed(true)} />
            {bars.length > 0 && sel && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 min-[700px]:p-4">
                <div className={`pointer-events-auto rounded-t-3xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] ${PANEL} min-[700px]:pointer-events-none min-[700px]:flex min-[700px]:items-end min-[700px]:gap-3 min-[700px]:border-0 min-[700px]:bg-transparent min-[700px]:pb-0 min-[700px]:backdrop-blur-none`}>
                  <GlobeCard
                    headline={headline}
                    facts={facts}
                    layer={layer}
                    day={day}
                    dots={dots}
                    expanded={open}
                    onToggle={(to) => setOpen((o) => to ?? !o)}
                    className={`min-[700px]:pointer-events-auto min-[700px]:w-[440px] min-[700px]:shrink-0 ${SIDE_PANEL}`}
                  />
                  <Timeline
                    bars={bars}
                    marks={marks}
                    selected={at}
                    readout={readout}
                    busy={!ready}
                    playing={playing}
                    onPick={(i) => go(selectAt(bars[i], stepsFor(bars[i]), hour))}
                    onNudge={(unit, dir) => go((unit === "day" ? moveDay : moveStep)(bars, stepsFor, sel, dir))}
                    onEdge={(end) => {
                      const list = bars.filter((b) => stepsFor(b).length);
                      const b = end === "first" ? list[0] : list.at(-1);
                      if (b) go(selectAt(b, stepsFor(b), hour));
                    }}
                    onPlay={play}
                    className={`min-[700px]:pointer-events-auto min-[700px]:min-w-0 min-[700px]:flex-1 min-[700px]:pt-3 ${SIDE_PANEL}`}
                  />
                </div>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
