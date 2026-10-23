"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { fmtDateShort, fmtHour, fmtLongWhen, fmtWeekday } from "@/lib/format";
import type { HistoryDay } from "@/lib/historyTypes";
import { loadDay } from "@/lib/historyClient";
import { fireDayAt, frameAt, originSteps } from "@/lib/originSteps";
import { PM25, bandNames, bandOf, rampCss } from "@/lib/pollutants";
import { WIND_NOTE } from "@/lib/links";
import { AHEAD_LABEL, FIRE_COLOR, NEW_FIRE_COLOR, TRAIL_COLOR, fetchReplay, fetchSmoke, newFires, newZonesText, trailCaption, windAtSg, windText } from "@/lib/replay";
import { RELIEF, SAT_BOX, atImage, onImage } from "@/lib/satellite";
import type { Replay, SmokeGrid } from "@/lib/types";
import { SG, sgDate } from "@/lib/util";
import { sample } from "@/lib/wind";
import { windOf, type WindView } from "@/lib/windParticles";
import AirJourney from "./AirJourney";
import { drawField } from "./globe/fieldImage";
import InfoNote from "./InfoNote";
import RampBar from "./RampBar";
import SgPin from "./SgPin";
import SmokeAhead from "./SmokeAhead";
import { Section } from "./ui";
import { useWindParticles } from "./useWindParticles";
import WindMotionButton, { useWindMotion } from "./WindMotion";

const W = 1000;
const H = 520; // same shape as the satellite box
const at = ([lat, lon]: [number, number]) => {
  const p = onImage(lat, lon);
  return [(p.x / 100) * W, (p.y / 100) * H] as const;
};

const MARK_H = 24; // the trail is marked at every 24 h back
const VEIL_PX = 20; // pixels per degree of the PM2.5 picture: 500 by 260 over SAT_BOX, which CSS stretches to the card
const KEY_STEP = 0.5; // degrees an arrow key moves the reading spot

/** The relief image as the wind animation sees it: a flat picture of `SAT_BOX` that never moves, so only a resize needs telling. */
function imageView(container: HTMLElement): WindView {
  const [south, west, north, east] = SAT_BOX;
  const size = () => ({ w: container.clientWidth, h: container.clientHeight });
  return {
    container,
    zIndex: 0,
    size,
    project: (lat, lon) => {
      const p = onImage(lat, lon);
      const { w, h } = size();
      return { x: (p.x / 100) * w, y: (p.y / 100) * h };
    },
    bounds: () => [south, west, north, east],
    pxPerDeg: () => size().w / (east - west),
    listen: ({ resized }) => {
      const ro = new ResizeObserver(resized);
      ro.observe(container);
      return () => ro.disconnect();
    },
  };
}

/**
 * "Where today's air came from": the back-trajectory of the air reaching Singapore over a relief map, with the Copernicus PM2.5
 * forecast as a veil under the wind. One time slider runs over the earlier replay days (path, fires and wind of each), now and the
 * next 3 days of the forecast; tapping the map reads the PM2.5 at that spot.
 */
export default function HazeOrigin({ className }: { className?: string }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [smoke, setSmoke] = useState<SmokeGrid | null>(null);
  const [failed, setFailed] = useState(false);
  const [smokeFailed, setSmokeFailed] = useState(false);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null); // where the wind lines are drawn
  const [veil, setVeil] = useState<HTMLCanvasElement | null>(null); // where the PM2.5 is drawn
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [frame, setFrame] = useState<number | null>(null); // the slider's step; null is "now"
  const [spot, setSpot] = useState<[number, number] | null>(null); // where the map was tapped
  const [focused, setFocused] = useState(false); // the map has the keyboard
  const [history, setHistory] = useState<Record<string, HistoryDay | null>>({}); // the days the slider has been on: their file, or null where there is none
  const { reduced, motion, toggle } = useWindMotion();

  useEffect(() => {
    fetchReplay()
      .then((r) => (r.days.length ? setReplay(r) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  // The forecast grid is about 250 KB (74 KB gzipped, with the gases): fetched when the map is about to scroll into view, not on every visit.
  useEffect(() => {
    if (!figure) return;
    const load = () => fetchSmoke().then(setSmoke, () => setSmokeFailed(true));
    if (!("IntersectionObserver" in window)) return void load();
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        load();
      },
      { rootMargin: "400px" },
    );
    io.observe(figure);
    return () => io.disconnect();
  }, [figure]);

  const steps = useMemo(() => (replay ? originSteps(replay, smoke) : []), [replay, smoke]);
  const nowAt = steps.findIndex((s) => s.kind === "now");
  const pos = Math.min(frame ?? nowAt, steps.length - 1);
  const step = steps[pos];
  const day = replay && step ? replay.days[step.day] : null;
  const future = step?.kind === "ahead";
  const date = step?.kind === "past" ? day?.date : undefined;

  // A past day's PM2.5 is from its history file (CAMS at 3-hour steps, from jsDelivr).
  useEffect(() => {
    if (date && !(date in history)) loadDay(date).then((d) => setHistory((h) => ({ ...h, [date]: d })));
  }, [date, history]);

  // The PM2.5 of the step and the grid it is on; null where there is none (no file, or no frame near the day's air).
  const model = useMemo(() => {
    if (!step || !day) return null;
    if (step.kind !== "past") return smoke && step.frame != null && smoke.values[step.frame] ? { grid: smoke, values: smoke.values[step.frame] } : null;
    const h = history[day.date];
    const f = h ? frameAt(h, day.arrival) : null;
    const values = f != null ? h?.gases.pm25?.[f] : undefined;
    return h && values ? { grid: h, values } : null;
  }, [step, day, smoke, history]);
  // The veil is placed by the grid's own corners, so any box lines up with the relief.
  const box = useMemo(() => {
    if (!model) return null;
    const { lats, lons } = model.grid;
    const nw = onImage(lats[lats.length - 1], lons[0]);
    const se = onImage(lats[0], lons[lons.length - 1]);
    return { left: `${nw.x}%`, top: `${nw.y}%`, width: `${se.x - nw.x}%`, height: `${se.y - nw.y}%` };
  }, [model]);

  // The wind of the step: the replay day's, or on a forecast step the forecast's.
  const winds = useMemo(() => {
    if (!replay || !day || !step) return null;
    if (!future) return { lats: replay.lats, lons: replay.lons, ...day.wind };
    return smoke?.wind && step.frame != null ? { lats: smoke.lats, lons: smoke.lons, u: smoke.wind.u[step.frame], v: smoke.wind.v[step.frame] } : null;
  }, [replay, smoke, day, step, future]);

  // The fires of the step: a past day's own; for now and the forecast the newest day with enough of them, as the globe does (the first
  // hours of a day have few). The forecast draws them dimmed.
  const fireAt = replay && step ? fireDayAt(replay.days, step.day, step.kind === "past") : 0;
  const fireDay = replay?.days[fireAt];
  const fires = fireDay?.fires ?? [];

  const view = useMemo(() => (layer ? imageView(layer) : undefined), [layer]);
  const wind = useMemo(() => (winds ? windOf(winds.lats, winds.lons, winds.u, winds.v) : undefined), [winds]);
  useWindParticles(view, wind, motion, "#fff");

  // Drawn once per frame at most, so that dragging the slider stays smooth.
  useEffect(() => {
    if (!veil) return;
    const id = requestAnimationFrame(() => {
      if (model) drawField(model.grid, model.values, "pm25", veil, VEIL_PX);
      else veil.getContext("2d")?.clearRect(0, 0, veil.width, veil.height);
    });
    return () => cancelAnimationFrame(id);
  }, [veil, model]);

  if (failed) return null;

  const tap = (lat: number, lon: number) => setSpot([Math.min(SAT_BOX[2], Math.max(SAT_BOX[0], lat)), Math.min(SAT_BOX[3], Math.max(SAT_BOX[1], lon))]);
  const onTap = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tap(...atImage(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100));
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const d = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    tap((spot?.[0] ?? SG.lat) + d[0] * KEY_STEP, (spot?.[1] ?? SG.lon) + d[1] * KEY_STEP);
  };
  const here = model && spot ? sample({ lats: model.grid.lats, lons: model.grid.lons, data: model.values }, spot[0], spot[1]) : null;
  const names = bandNames(PM25);
  const reading = here != null ? `${Math.round(here).toLocaleString("en-SG")} ${PM25.unit}, ${names[bandOf(PM25, here)]}` : null;
  const prompt = reading
    ? `PM2.5 at this spot: about ${reading}`
    : model
      ? `Tap the map to read the smoke level at a spot.${focused ? " Arrow keys move the spot." : ""}`
      : step?.kind === "past"
        ? date && date in history
          ? "No PM2.5 model for this day"
          : "Loading the PM2.5 for this day…"
        : smokeFailed
          ? "The PM2.5 model is unavailable right now."
          : "Loading the PM2.5 model…";

  // Origin first, so the flowing dashes move towards Singapore.
  const path = day?.trail.length && !future ? [...day.trail].reverse().map((p) => at(p).join(",")).join(" ") : "";

  const ahead = day?.ahead && day.ahead.path.length > 1 && step?.kind !== "past" ? day.ahead.path.map((p) => at(p).join(",")).join(" ") : "";
  const fresh = replay && step && !future ? newFires(replay.days.slice(0, fireAt + 1)) : [];
  const fireNote = fireDay && step && (future || fireAt !== step.day) ? fmtDateShort(fireDay.date) : null; // which day the fires are from, when it is not plain
  const sgWind = winds ? windAtSg(winds, winds) : null;
  // A dot and the weekday at every 24 h back along the trail.
  const marks = [];
  for (let h = MARK_H; day && !future && h < day.trail.length; h += MARK_H) {
    marks.push({ ...onImage(...day.trail[h]), label: fmtWeekday(sgDate(0, new Date(Date.parse(day.arrival) - h * 3600_000))) });
  }
  const today = replay ? replay.days.length - 1 : 0;
  const when = step?.kind === "past" ? daysAgo(today - step.day) : step?.kind === "ahead" ? `in ${(pos - nowAt) * 3} h` : "now";

  return (
    <Section id="origin" className={className} title="Where today's air came from">
      <figure ref={setFigure} className="px-4">
        <div
          onClick={onTap}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          role="group"
          tabIndex={0}
          aria-label="Smoke map. Tap to read the smoke level at a spot, or use the arrow keys."
          className={`relative aspect-[1000/520] overflow-hidden rounded-2xl bg-line outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${day ? "cursor-crosshair" : "animate-pulse"}`}
        >
          {day && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves a sized image; no optimisation needed */}
              <img src={RELIEF} alt="Relief map of Sumatra, Singapore and Borneo" width={W} height={H} className="absolute inset-0 h-full w-full" />
              {/* The PM2.5 veil: between the relief and the wind, so the wind, path and fires stay clear of it */}
              <canvas ref={setVeil} aria-hidden className={`absolute ${model ? "" : "invisible"}`} style={box ?? undefined} />
              <div ref={setLayer} aria-hidden className="absolute inset-0" />
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
                {fires.map((p, i) => {
                  const [x, y] = at(p);
                  return <circle key={i} cx={x} cy={y} r={6} fill={FIRE_COLOR} fillOpacity={future ? 0.4 : 0.85} />;
                })}
                {ahead && (
                  // Where smoke from today's fires goes next, under the trail: from the fire towards Singapore.
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={ahead} stroke="#fff" strokeOpacity={0.55} strokeWidth={6} vectorEffect="non-scaling-stroke" />
                    <polyline points={ahead} stroke={FIRE_COLOR} strokeWidth={3} strokeDasharray="7 7" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
                {path && (
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={path} stroke={TRAIL_COLOR} strokeOpacity={0.3} strokeWidth={14} vectorEffect="non-scaling-stroke" />
                    <polyline points={path} stroke={TRAIL_COLOR} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                    <polyline
                      points={path}
                      stroke="#fff"
                      strokeOpacity={0.8}
                      strokeWidth={1.5}
                      strokeDasharray="2 10"
                      vectorEffect="non-scaling-stroke"
                      className="animate-flow motion-reduce:hidden"
                    />
                  </g>
                )}
                {fresh.map((p, i) => {
                  const [x, y] = at(p);
                  return (
                    <g key={i} fill="none">
                      <circle cx={x} cy={y} r={13} stroke="#000" strokeOpacity={0.4} strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
                      <circle cx={x} cy={y} r={13} stroke={NEW_FIRE_COLOR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
                {spot && (
                  <g fill="none">
                    <circle cx={at(spot)[0]} cy={at(spot)[1]} r={9} stroke="#000" strokeOpacity={0.5} strokeWidth={4.5} vectorEffect="non-scaling-stroke" />
                    <circle cx={at(spot)[0]} cy={at(spot)[1]} r={9} stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                  </g>
                )}
              </svg>
              {marks.map((m) => (
                <span key={m.label} aria-hidden className="absolute" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
                  <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white" style={{ borderColor: TRAIL_COLOR }} />
                  <span
                    className={`absolute top-0 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold text-white [text-shadow:0_0_3px_#000,0_1px_2px_#000] ${m.x > 85 ? "right-2" : "left-2"}`}
                  >
                    {m.label}
                  </span>
                </span>
              ))}
              <SgPin />
              {sgWind && <span className="sg-label bottom-2 left-2">{windText(sgWind)}</span>}
            </>
          )}
        </div>

        <div className="mt-3 min-h-[8.5rem]">
          {day && step && (
            <>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="tabular font-bold">
                  {fmtDateShort(sgDate(0, new Date(step.t)))}, {fmtHour(step.t)}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {when}
                  {pos !== nowAt && (
                    <button onClick={() => setFrame(null)} className="-my-3 min-h-[44px] font-semibold text-accent">
                      Back to now
                    </button>
                  )}
                </span>
              </div>
              <input
                type="range"
                className="slider block h-11 w-full"
                min={0}
                max={smoke ? steps.length - 1 : nowAt + 24}
                value={pos}
                onChange={(e) => setFrame(Math.min(Number(e.target.value), steps.length - 1))}
                aria-label="Time: earlier days, now and the forecast"
                aria-valuetext={fmtLongWhen(step.t)}
                disabled={steps.length < 2}
              />
              <p aria-live="polite" className="mt-1 text-[14px] font-semibold">
                {prompt}
                {reading && <span className="font-normal text-muted"> (model)</span>}
              </p>
              <div className="mt-2">
                <RampBar background={rampCss(PM25)} names={names} bar="border-line bg-line" text="text-muted" label={`PM2.5 colour scale: ${names.join(", ")}`} />
              </div>
            </>
          )}
        </div>

        <figcaption className="mt-3 min-h-[18rem] text-[13px] text-muted">
          {day && step && (
            <>
              {(fresh.length > 0 || ahead || fireNote) && (
                <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {fresh.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-3 rounded-full border-[1.5px]" style={{ borderColor: NEW_FIRE_COLOR }} />
                      {newZonesText(fresh.length)}
                      {fireAt === step.day ? (step.kind === "past" ? " that day" : " today") : ""}
                    </span>
                  )}
                  {fireNote && <span>Fires of {fireNote}</span>}
                  {ahead && (
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="w-4 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />
                      {AHEAD_LABEL}
                    </span>
                  )}
                </p>
              )}
              {reduced && <WindMotionButton motion={motion} onToggle={toggle} className="mb-3" />}
              {day.journey ? <AirJourney day={day} shareable={step.kind !== "past"} /> : <p className="text-[15px] font-bold text-fg">{trailCaption(day)}</p>}
              <p className="mt-3">Traced back 3 days along the wind about 1.5 km up. Fires near the path are a likely, not certain, source.</p>
              <Link href="/map?view=path" className="mt-1 inline-block py-1 text-[14px] font-semibold text-accent">
                See it on the map
              </Link>
              <div className="mt-3">
                <InfoNote>
                  <p>
                    Shading is the Copernicus (CAMS) PM2.5 forecast, coloured by NEA&apos;s 1-hour bands. Earlier days are the same model&apos;s past values. {WIND_NOTE}
                  </p>
                </InfoNote>
              </div>
              {replay?.days.at(-1)?.ahead && (
                // Today's smoke on the way: on a past day its space is kept, so the page below does not jump.
                <div className={step.kind === "past" ? "invisible" : ""} aria-hidden={step.kind === "past"}>
                  <SmokeAhead ahead={replay.days.at(-1)!.ahead!} />
                </div>
              )}
            </>
          )}
        </figcaption>
      </figure>
    </Section>
  );
}

/** "1 day ago", "3 days ago". */
const daysAgo = (n: number) => `${n} ${n === 1 ? "day" : "days"} ago`;
