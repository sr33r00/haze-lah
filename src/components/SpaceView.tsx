"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { fmtDateShort, fmtRange } from "@/lib/format";
import {
  DATA_OPACITY,
  FRAMES,
  GLOBE_CREDIT,
  GLOBE_LAYERS,
  LAYERS,
  PASS_TIME,
  REGION,
  REGION_COAST,
  fmtReading,
  globeDates,
  globeDays,
  globeSeries,
  globePicture,
  isClear,
  mercY,
  rampCss,
  weekBefore,
  type GlobeLayer,
} from "@/lib/globe";
import { fetchBasemap } from "@/lib/basemap";
import { WIND_NOTE } from "@/lib/links";
import { FIRE_COLOR, TRAIL_COLOR, fetchReplay } from "@/lib/replay";
import type { Fire, Replay } from "@/lib/types";
import { SG, sgDate } from "@/lib/util";
import DayBars from "./DayBars";
import type { Flow } from "./GlobeMap";
import PlayButton from "./PlayButton";
import SgPin from "./SgPin";
import WindMotionButton, { useWindMotion } from "./WindMotion";

const CHIP = "min-h-[32px] min-w-0 flex-auto rounded-full px-3 text-[12px] font-semibold transition-colors";
const STEP_MS = 800; // time on each day while playing
const HOLD_MS = 1500; // time on the newest day before it loops
const LAST = FRAMES - 1;
type Series = Record<string, number | null>;
const NONE: Fire[] = []; // one empty list, so showing no fires is not a change each step
const FADE = "transition-opacity duration-700 motion-reduce:transition-none";

// The poster is the world picture (a Web Mercator square) placed so that REGION is centred in the stage and fills it.
const WORLDS = 360 / (REGION[3] - REGION[1]); // how many regions wide the world is
const ROWS = (mercY(REGION[0]) - mercY(REGION[2])) * WORLDS; // the region's height, in its widths
const R = `max(100cqw, 100cqh / ${ROWS})`; // width of the region when it just covers the stage
const MID = { x: ((REGION[1] + REGION[3]) / 2 + 180) / 360, y: (mercY(REGION[0]) + mercY(REGION[2])) / 2 };
const POSTER: CSSProperties = {
  width: `calc(${R} * ${WORLDS})`,
  height: `calc(${R} * ${WORLDS})`,
  left: `calc(50cqw - ${R} * ${WORLDS * MID.x})`,
  top: `calc(50cqh - ${R} * ${WORLDS * MID.y})`,
};
const COAST_AT: CSSProperties = {
  left: `${((REGION[1] + 180) / 360) * 100}%`,
  top: `${mercY(REGION[2]) * 100}%`,
  width: `${100 / WORLDS}%`,
  height: `${(mercY(REGION[0]) - mercY(REGION[2])) * 100}%`,
};
const AT_SG = { x: ((SG.lon + 180) / 360) * 100, y: mercY(SG.lat) * 100 };

/** Runs `run` when the browser is idle (at the latest after `timeout` ms); returns the way to cancel it. */
function whenIdle(run: () => void, timeout: number) {
  if (!("requestIdleCallback" in window)) {
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }
  const id = requestIdleCallback(run, { timeout });
  return () => cancelIdleCallback(id);
}

/** Runs `run` once the page has loaded and the browser is idle, so that it takes nothing from the page itself; returns the way to cancel it. */
function whenQuiet(run: () => void) {
  let cancel = () => {};
  const go = () => {
    cancel = whenIdle(run, 2000);
  };
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
  return () => {
    removeEventListener("load", go);
    cancel();
  };
}

type Connection = { saveData?: boolean; effectiveType?: string };

/** The map only loads where it will run well: WebGL, no data saver, not 2G. */
function canRunMap() {
  const net = (navigator as Navigator & { connection?: Connection }).connection;
  if (net?.saveData || /2g$/.test(net?.effectiveType ?? "")) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * NASA satellite pollution data on a map you can zoom and move. A flat poster of Southeast Asia is the whole experience
 * until the stage is on screen and the device can run WebGL; then the map starts and fades in over it. The map's code (and its
 * style) load once the page is quiet, where the device can run it, so that they are here by the time the stage is.
 * The card tells the day's reading over Singapore either way, and the bars under it are the days: tap one, or play
 * through the last week, one picture per day, fetched only once asked for. `now` comes from the server so both renders
 * build the same URLs; `fires` are the strongest recent detections.
 */
export default function SpaceView({ now, fires }: { now: number; fires: Fire[] }) {
  const [layer, setLayer] = useState<GlobeLayer>(LAYERS[0]);
  const [day, setDay] = useState(LAST); // the day chosen: an index into `frames`
  const [shown, setShown] = useState(LAST); // the day on view: the one chosen, once its picture has arrived
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({}); // every frame asked for: did it arrive?
  const [GlobeMap, setGlobeMap] = useState<typeof import("./GlobeMap").default>();
  const [replay, setReplay] = useState<Replay>(); // the last 5 days of the air's path and wind, if they could be fetched
  const [series, setSeries] = useState<Partial<Record<GlobeLayer, Series>>>({}); // each layer's readings over Singapore, once they arrive
  const [capable, setCapable] = useState(false);
  const [inView, setInView] = useState(false);
  const [woken, setWoken] = useState(false); // the stage has been in view (or near it): the map is made, and stays
  const [ready, setReady] = useState(false);
  const [late, setLate] = useState(false); // the default layer's picture is here and the browser is idle: time for the other layers
  const { reduced, motion, toggle: toggleMotion } = useWindMotion();
  const stage = useRef<HTMLDivElement>(null);
  const asked = useRef(new Set<GlobeLayer>()); // the layers whose readings have been asked for

  const { label, ramp, note, days: span } = GLOBE_LAYERS[layer];
  const dates = useMemo(() => globeDates(now), [now]);
  const frames = useMemo(
    () =>
      Object.fromEntries(
        LAYERS.map((key) => [
          key,
          dates.map((date, i) => {
            const days = globeDays(key, date);
            return { url: globePicture(key, i === LAST ? undefined : date), range: fmtRange(days[0], days.at(-1)!) }; // the newest frame is the default picture
          }),
        ]),
      ) as Record<GlobeLayer, { url: string; range: string }[]>,
    [dates],
  );

  // Nothing beyond the newest day is fetched until the viewer plays or picks another day.
  const wanted = playing || day !== LAST;
  const mine = frames[layer];
  const status = (i: number) => i === LAST || loaded[mine[i].url]; // true: here, false: failed, undefined: still coming
  const chosen = status(day);
  if (chosen !== undefined && shown !== (chosen ? day : LAST)) setShown(chosen ? day : LAST); // until the chosen day's picture is here, the one on view stays
  const view = status(shown) ? shown : LAST; // a layer switch starts with the newest, until the shown day's picture of that layer is here
  const next = Array.from({ length: FRAMES }, (_, k) => (day + k + 1) % FRAMES).find((i) => status(i) !== false) ?? day;
  const stalled = chosen === undefined || status(next) === undefined; // playing waits here rather than skip ahead
  const mark = useCallback((url: string, ok: boolean) => setLoaded((l) => (l[url] === ok ? l : { ...l, [url]: ok })), []);
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setCapable(false), []); // the poster stays, and does the playing
  const primed = loaded[frames[LAYERS[0]][LAST].url] !== undefined; // the default layer's newest picture has arrived (or failed)
  const picture = loaded[mine[view].url] !== undefined ? mine[view].url : undefined; // the map takes a picture only once the poster's <img> has it: from the browser's cache, not a second request

  useEffect(() => {
    setCapable(canRunMap());
    const seen = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting);
      if (e.isIntersecting) setWoken(true);
    }, { rootMargin: "800px" });
    seen.observe(stage.current!);
    return () => seen.disconnect();
  }, []);

  // The other layers wait for the default one's picture, so that it gets the server first; they follow when the browser is idle.
  useEffect(() => (primed ? whenIdle(() => setLate(true), 2000) : undefined), [primed]);

  // The readings are tiny, and preloaded by the page: the layer on view first, the rest once `late`.
  useEffect(() => {
    new Set(late ? LAYERS : [LAYERS[0], layer]).forEach((key) => {
      if (asked.current.has(key)) return;
      asked.current.add(key);
      fetch(globeSeries(key))
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ values }: { values: Series }) => setSeries((s) => ({ ...s, [key]: values })))
        .catch(() => setSeries((s) => ({ ...s, [key]: {} }))); // no readings: the bars and the card just say so
    });
  }, [late, layer]);

  // The air's wind, for the map: asked for as soon as the device is known to run it (the page has started the request, and the smoke map shares it).
  useEffect(() => {
    if (capable)
      fetchReplay()
        .then(setReplay)
        .catch(() => {});
  }, [capable]);

  // The map's code and style are fetched once the page is quiet, or at once when the stage is already in view; the map itself is made only when the stage is near.
  useEffect(() => {
    if (!capable || GlobeMap) return;
    const load = () => {
      import("./GlobeMap")
        .then((m) => setGlobeMap(() => m.default))
        .catch(() => setCapable(false));
      fetchBasemap().catch(() => {}); // the map asks again, and fails the card over to the poster, if it cannot be had
    };
    if (inView) return void load();
    return whenQuiet(load);
  }, [capable, inView, GlobeMap]);

  // With the map, the days are fetched oldest first, into the browser's cache, so that no step waits. Otherwise the poster's pictures load them.
  useEffect(() => {
    if (!GlobeMap || !wanted) return;
    mine.forEach(({ url }) =>
      fetch(url).then(
        (r) => (r.ok ? r.blob().then(() => mark(url, true)) : mark(url, false)),
        () => mark(url, false),
      ),
    );
  }, [GlobeMap, wanted, mine, mark]);

  // Play: one day after another, a longer look at the newest, then round again. Each step waits for the next day's picture; one that failed to load is skipped.
  useEffect(() => {
    if (!playing || stalled || !inView) return;
    const id = setTimeout(() => setDay(next), day === LAST ? HOLD_MS : STEP_MS);
    return () => clearTimeout(id);
  }, [playing, stalled, inView, day, next]);
  const toggle = () => {
    if (!playing && day === LAST) setDay(0); // from last week
    setPlaying(!playing);
  };

  const today = view === LAST; // fires and the forecast path are today's
  const date = dates[view];
  // The replay's day for the one on view, matched by its SGT date (YYYY-MM-DD, as the bars are labelled). The newest picture is always the newest replay day. Older days outside the replay have none.
  const air = replay && (today ? replay.days.at(-1) : replay.days.find((d) => d.date === date));
  const ahead = today && air?.ahead && air.ahead.fires > 0 ? air.ahead.path : undefined;
  const flow = useMemo<Flow | undefined>(() => (replay && air ? { lats: replay.lats, lons: replay.lons, wind: air.wind } : undefined), [replay, air]);
  const values = series[layer];
  const reading = values?.[date];
  const before = values?.[weekBefore(date)];
  const pct = reading != null && before != null && !isClear(layer, reading) && !isClear(layer, before) && before > 0 ? Math.round(((reading - before) / before) * 100) : null;
  return (
    <div className="px-4">
      <div role="group" aria-label="Choose layer" className="mb-2 flex gap-1 rounded-full bg-surface p-1">
        {LAYERS.map((key) => (
          <button key={key} onClick={() => setLayer(key)} aria-pressed={layer === key} className={`${CHIP} ${layer === key ? "bg-fg text-bg" : "text-muted"}`}>
            {GLOBE_LAYERS[key].label}
          </button>
        ))}
      </div>

      <div ref={stage} className="stars space-card relative aspect-square max-h-[640px] overflow-hidden rounded-3xl [container-type:size] sm:aspect-[16/9]">
        <div aria-hidden={ready} className={`absolute inset-0 ${FADE} ${ready ? "opacity-0" : ""}`}>
          <div className="absolute" style={POSTER}>
            {/* The newest picture of each layer always stays mounted, so switching layers swaps them with no wait; the other days are here only when the poster plays (no map). */}
            {LAYERS.flatMap((key) =>
              frames[key].map(({ url, range }, i) => {
                const on = key === layer && i === view;
                if (i !== LAST && !(key === layer && wanted && !capable)) return null;
                if (i === LAST && key !== LAYERS[0] && key !== layer && !late) return null; // the other layers' newest pictures wait for `late`
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- the server builds sized images; no optimisation needed
                  <img
                    key={url}
                    src={url}
                    alt={on ? `${label}, satellite view of Southeast Asia, ${range}` : ""}
                    aria-hidden={!on}
                    loading={i === LAST ? "lazy" : "eager"}
                    decoding="async"
                    onLoad={() => mark(url, true)}
                    onError={() => mark(url, false)}
                    style={{ opacity: on ? DATA_OPACITY : 0 }}
                    className="absolute size-full max-w-none"
                  />
                );
              }),
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- a fixed picture of coastlines; see REGION_COAST */}
            <img src={REGION_COAST} alt="" aria-hidden loading="lazy" decoding="async" style={COAST_AT} className="absolute max-w-none" />
            <SgPin at={AT_SG} />
          </div>
        </div>

        {capable && GlobeMap && woken && (
          <div className={`absolute inset-0 ${FADE} ${ready ? "" : "opacity-0"}`}>
            <GlobeMap url={picture} layer={layer} fires={today ? fires : NONE} trail={air?.trail} ahead={ahead} flow={flow} motion={motion} onReady={onReady} onFail={onFail} />
          </div>
        )}

        <span
          className={`tabular absolute left-3 top-3 max-w-[calc(100%-7rem)] rounded-2xl bg-black/70 px-2.5 py-1 text-white ${chosen === undefined ? "motion-safe:animate-pulse" : ""}`} // pulses while the chosen day loads
          aria-live={playing ? "off" : "polite"} // a step every second is too much to read out
          aria-busy={chosen === undefined}
        >
          {span > 1 && <span className="block text-[10px] leading-tight text-white/70">{span}-day average to</span>}
          <span className="block text-[12px] font-semibold leading-tight">
            {fmtDateShort(date)} · {PASS_TIME}
          </span>
        </span>

        <p
          className="tabular pointer-events-none absolute bottom-2 left-2 flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-3 gap-y-0.5 rounded-2xl bg-black/70 px-3 py-2 text-[13px] text-white"
          aria-live={playing ? "off" : "polite"}
        >
          <span className="text-white/70">Over Singapore</span>
          {values ? (
            <span className="font-bold">{reading == null ? "no reading" : fmtReading(layer, reading)}</span>
          ) : (
            <span aria-hidden className="h-3 w-14 rounded bg-white/20 motion-safe:animate-pulse" />
          )}
          {pct !== null && (
            <span className={`text-[12px] font-semibold ${pct === 0 ? "text-white/70" : pct > 0 ? "text-red-400" : "text-green-400"}`}>
              {pct === 0 ? (
                "Level with last week"
              ) : (
                <>
                  <span aria-hidden>{pct > 0 ? "▲" : "▼"}</span>
                  <span className="sr-only">{pct > 0 ? "Up" : "Down"} </span> {Math.abs(pct)}% vs last week
                </>
              )}
            </span>
          )}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <PlayButton playing={playing} loading={playing && stalled} onClick={toggle} what="the last week" />
        <DayBars
          layer={layer}
          dates={dates}
          values={values}
          today={sgDate(0, new Date(now))}
          selected={day}
          onPick={(i) => {
            setPlaying(false);
            setDay(i);
          }}
        />
      </div>

      <div className="mt-3 text-[13px] text-muted">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          {ramp.ends[0]}
          <span aria-hidden className="h-2 flex-1 rounded-full" style={{ background: rampCss(ramp) }} />
          {ramp.ends[1]}
        </div>
        <p className="tabular mb-1 mt-0.5 text-center text-[11px] opacity-80">
          {ramp.unit}: {ramp.range[0]} to {ramp.range[1]}+
        </p>
        <div className="mb-1 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {today && fires.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: FIRE_COLOR }} />
              Fires
            </span>
          )}
          {air && (
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ background: TRAIL_COLOR }} />
              Air&apos;s path, last 3 days
            </span>
          )}
          {ahead && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />
              Smoke on the way
            </span>
          )}
        </div>
        {replay && (
          <p aria-live="polite" className={`mb-1 text-[12px] ${flow ? "" : "invisible"}`}>
            {WIND_NOTE}
          </p>
        )}
        {reduced && flow && <WindMotionButton motion={motion} onToggle={toggleMotion} className="mb-1" />}
        <p aria-live="polite">{note}</p>
      </div>
      <p className="mt-1 text-[12px] text-muted">{GLOBE_CREDIT}</p>
    </div>
  );
}
