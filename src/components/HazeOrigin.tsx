"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { LEVEL_NAME, LEVEL_TEXT, psiLevel } from "@/lib/bands";
import { fmtDateShort, fmtDay, fmtDayHour, fmtHour, fmtLongWhen, fmtWeekday } from "@/lib/format";
import type { HistoryDay } from "@/lib/historyTypes";
import { loadDay } from "@/lib/historyClient";
import { fireDayAt, frameAt, originSteps } from "@/lib/originSteps";
import { PM25, bandNames, bandOf } from "@/lib/pollutants";
import { WIND_NOTE } from "@/lib/links";
import { bandColor, readingDots } from "@/lib/readings";
import { AHEAD_LABEL, FIRE_COLOR, NEW_FIRE_COLOR, TRAIL_COLOR, fetchReplay, fetchSmoke, newFires, newZonesText, trailCaption, windAtSg, windText } from "@/lib/replay";
import { islandMax } from "@/lib/situation";
import type { NeaNow, NeaPm25History, Replay, Sensor, SmokeGrid, Station } from "@/lib/types";
import { SG, sgDate } from "@/lib/util";
import { sample } from "@/lib/wind";
import AirJourney from "./AirJourney";
import InfoNote from "./InfoNote";
import type { OriginLayers } from "./OriginMap";
import PlayButton from "./PlayButton";
import SmokeAhead from "./SmokeAhead";
import { Section } from "./ui";
import WindMotionButton, { useWindMotion } from "./WindMotion";

// Leaflet needs the browser, so the map is loaded on the client only.
const OriginMap = dynamic(() => import("./OriginMap"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-line" /> });

const MARK_H = 24; // the trail is marked at every 24 h back
const KEY_STEP = 0.5; // degrees an arrow key moves the reading spot
const PLAY_MS = 700; // between the steps of the play button
const AHEAD_DAYS = 3; // the smoke forecast runs 72 h

/**
 * "Where today's air came from": the back-trajectory of the air reaching Singapore on a zoomable map (OriginMap), with the Copernicus PM2.5
 * forecast as a veil under the wind. One time slider runs over the earlier replay days (path, fires and wind of each), now and the
 * next 3 days of the forecast; tapping the map reads the PM2.5 at that spot.
 */
export default function HazeOrigin({
  className,
  nea,
  history: nowHistory,
  stations,
  sensors,
}: {
  className?: string;
  nea: NeaNow | null;
  history: NeaPm25History | null;
  stations: Station[];
  sensors: Sensor[];
}) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [smoke, setSmoke] = useState<SmokeGrid | null>(null);
  const [failed, setFailed] = useState(false);
  const [smokeFailed, setSmokeFailed] = useState(false);
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [frame, setFrame] = useState<number | null>(null); // the slider's step; null is "now"
  const [playing, setPlaying] = useState(false);
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

  // The play button walks the steps from where the slider is, round to the start again.
  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const id = setInterval(() => setFrame((k) => ((k ?? nowAt) + 1) % steps.length), PLAY_MS);
    return () => clearInterval(id);
  }, [playing, steps.length, nowAt]);

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
  const fresh = replay && step && !future ? newFires(replay.days.slice(0, fireAt + 1)) : [];
  const fireNote = fireDay && step && (future || fireAt !== step.day) ? fmtDateShort(fireDay.date) : null; // which day the fires are from, when it is not plain
  const ahead = day?.ahead && day.ahead.path.length > 1 && step?.kind !== "past" ? day.ahead.path : [];
  const trail = day && !future ? day.trail : [];
  const sgWind = winds ? windAtSg(winds, winds) : null;
  // The readings are today's: dots on the now step only.
  const dots = useMemo(() => (step?.kind === "now" ? readingDots({ nea, history: nowHistory, stations, sensors }, "pm25", true) : []), [step?.kind, nea, nowHistory, stations, sensors]);
  // A dot and the weekday at every 24 h back along the trail.
  const marks: OriginLayers["marks"] = [];
  for (let h = MARK_H; day && !future && h < day.trail.length; h += MARK_H) {
    marks.push({ at: day.trail[h], label: fmtWeekday(sgDate(0, new Date(Date.parse(day.arrival) - h * 3600_000))) });
  }

  if (failed) return null;

  const tap = (lat: number, lon: number) => {
    const g = model?.grid; // the reading is only there inside the model's grid
    setSpot(g ? [Math.min(g.lats.at(-1)!, Math.max(g.lats[0], lat)), Math.min(g.lons.at(-1)!, Math.max(g.lons[0], lon))] : [lat, lon]);
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

  const today = replay ? replay.days.length - 1 : 0;
  const when = step?.kind === "past" ? daysAgo(today - step.day) : step?.kind === "ahead" ? `in ${(pos - nowAt) * 3} h` : "now";
  const stepDay = step ? sgDate(0, new Date(step.t)) : "";
  const label = step ? `${fmtDay(stepDay, stepDay === sgDate(0) ? 0 : stepDay === sgDate(1) ? 1 : 2)} ${fmtHour(step.t)}` : "";
  // The NEA PSI of the step: now, or the day's highest from its history file; none for the forecast.
  const psi = step?.kind === "now" ? (nea ? (islandMax(nea.psi24)?.psi ?? null) : null) : date ? (history[date]?.nea.psiMax ?? null) : null;
  const layers: OriginLayers = { model, wind: winds, motion, trail, marks, fires, firesDim: future, fresh, ahead, dots, spot: here != null ? spot : null };
  const hasSensors = dots.some((d) => d.rank === 2);

  return (
    <Section id="origin" className={className} title="Where today's air came from" aside={replay ? <span className="hidden whitespace-nowrap sm:inline">{`Past ${today} days to next ${AHEAD_DAYS}`}</span> : undefined}>
      <figure ref={setFigure} className="px-4">
        <div
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          role="group"
          tabIndex={0}
          aria-label="Smoke map. Tap to read the smoke level at a spot, or use the arrow keys."
          className="relative isolate h-[23rem] overflow-hidden rounded-2xl bg-line outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] lg:h-[30rem]"
        >
          <OriginMap layers={layers} onTap={(at) => tap(...at)} />
          {day && step && (
            <div className="pointer-events-none absolute inset-x-3 bottom-7 z-[500] rounded-2xl bg-surface/90 px-3 py-2 text-[13px] leading-snug shadow">
              {future ? (
                <p className="font-bold">Forecast, {fmtDayHour(step.t)}</p>
              ) : (
                psi != null && (
                  <p className="font-bold">
                    {step.kind === "past" ? "Highest PSI" : "PSI now"} {psi}, <span style={{ color: LEVEL_TEXT[psiLevel(psi)] }}>{LEVEL_NAME[psiLevel(psi)]}</span>
                  </p>
                )
              )}
              <p className="text-muted">{future ? "Path and fires are today's." : trailCaption(day)}</p>
            </div>
          )}
          {reduced && winds && <WindMotionButton motion={motion} onToggle={toggle} className="absolute right-3 top-3 z-[500]" />}
        </div>

        <div className="mt-3 min-h-[13.5rem]">
          {day && step && (
            <>
              <div className="flex items-center gap-3">
                <PlayButton playing={playing} onClick={() => setPlaying((p) => !p)} disabled={steps.length < 2} what="the smoke map" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="tabular font-bold">{label}</span>
                    <span className="flex items-center gap-3 text-muted">
                      {when}
                      {pos !== nowAt && (
                        <button
                          onClick={() => {
                            setPlaying(false);
                            setFrame(null);
                          }}
                          className="-my-3 min-h-[44px] font-semibold text-accent"
                        >
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
                    onChange={(e) => {
                      setPlaying(false);
                      setFrame(Math.min(Number(e.target.value), steps.length - 1));
                    }}
                    aria-label="Time: earlier days, now and the forecast"
                    aria-valuetext={fmtLongWhen(step.t)}
                    disabled={steps.length < 2}
                  />
                </div>
              </div>
              <p aria-live="polite" className={`mt-1 text-[13px] ${reading ? "font-semibold text-fg" : "text-muted"}`}>
                {prompt}
                {reading && <span className="font-normal text-muted"> (model)</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
                <span className="font-semibold">Smoke PM2.5</span>
                {names.map((n, i) => (
                  <span key={n} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-fg/30" style={{ background: bandColor(i as 0 | 1 | 2 | 3) }} />
                    {n}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: FIRE_COLOR }} />
                  {fireNote ? `Fires of ${fireNote}` : "Fires"}
                </span>
                {fresh.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="size-3 rounded-full border-[1.5px]" style={{ borderColor: NEW_FIRE_COLOR }} />
                    {newZonesText(fresh.length)}
                    {fireAt === step.day ? (step.kind === "past" ? " that day" : " today") : ""}
                  </span>
                )}
                {trail.length > 1 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-4 rounded-full" style={{ background: TRAIL_COLOR }} />
                    Air&apos;s path
                  </span>
                )}
                {ahead.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="w-4 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />
                    {AHEAD_LABEL}
                  </span>
                )}
                {dots.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full border-[1.5px] border-white bg-[var(--muted)] ring-1 ring-black/25" />
                    Stations
                  </span>
                )}
                {hasSensors && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full border border-white bg-[var(--muted)] ring-1 ring-black/25" />
                    Community sensors
                  </span>
                )}
                {winds && (
                  <span className="flex items-center gap-1.5">
                    <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden>
                      <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="animate-flow" />
                    </svg>
                    {sgWind ? windText(sgWind) : "Wind"}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <InfoNote
                  lead={
                    sensors.length > 0 && (
                      <span>
                        Data:{" "}
                        <a href="https://openaq.org" target="_blank" rel="noreferrer" className="underline">
                          OpenAQ
                        </a>{" "}
                        and AirGradient
                      </span>
                    )
                  }
                >
                  <p>
                    Shading is the Copernicus (CAMS) PM2.5 forecast, coloured by NEA&apos;s 1-hour bands. Earlier days are the same model&apos;s past values. {WIND_NOTE}
                  </p>
                  {sensors.length > 0 && <p>Community sensors are low-cost and can read high in humid air; NEA&apos;s readings are the official measure.</p>}
                </InfoNote>
              </div>
            </>
          )}
        </div>

        <figcaption className="mt-3 min-h-[14rem] text-[13px] text-muted">
          {day && step && (
            <>
              {day.journey ? <AirJourney day={day} shareable={step.kind !== "past"} /> : <p className="text-[15px] font-bold text-fg">{trailCaption(day)}</p>}
              <p className="mt-3">Traced back 3 days along the wind about 1.5 km up. Fires near the path are a likely, not certain, source.</p>
              <Link href="/map?view=path" className="mt-1 inline-block py-1 text-[14px] font-semibold text-accent">
                See it on the map
              </Link>
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
