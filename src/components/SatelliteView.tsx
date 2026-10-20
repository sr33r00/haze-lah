"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { fmtDate, fmtTime, fmtWeekday } from "@/lib/format";
import { sgDate } from "@/lib/util";
import { SAT_LAYERS, dailyImages, liveImage, type SatLayer } from "@/lib/satellite";
import SgPin from "./SgPin";

const STEP_MS = 1200;
const CHIP = "min-h-[32px] min-w-0 rounded-full text-[12px] font-semibold transition-colors";
const chipState = (on: boolean) => (on ? "bg-fg text-bg" : "text-muted");

/**
 * Satellite views of the region: the last few days in true colour with fires, smoke or carbon monoxide, and for true
 * colour the latest Himawari image. `now` comes from the server so both renders build the same URLs.
 */
export default function SatelliteView({ now }: { now: number }) {
  const [layer, setLayer] = useState<SatLayer>("true");
  const daily = useMemo(() => dailyImages(layer, now), [layer, now]);
  const live = useMemo(() => liveImage(now), [now]);
  const frames = [...daily].reverse(); // oldest first, so the chips read as a timeline
  const LIVE = frames.length;
  const [pick, setPick] = useState(LIVE - 1);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(() => new Set([LIVE - 1])); // images mount once first needed, then stay for a smooth fade

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPick((p) => (p + 1) % LIVE), STEP_MS);
    return () => clearInterval(id);
  }, [playing, LIVE]);

  const choose = (i: number) => {
    setPlaying(false);
    setPick(i);
    setShown((s) => new Set(s).add(i));
  };
  const switchLayer = (key: SatLayer) => {
    const i = key !== "true" && pick === LIVE ? LIVE - 1 : pick; // "Now" is true colour only
    setLayer(key);
    setPick(i);
    setShown(playing ? new Set(frames.map((_, k) => k)) : new Set([i]));
  };
  const togglePlay = () => {
    if (!playing) setShown(new Set(frames.map((_, i) => i)));
    if (!playing && pick === LIVE) setPick(0);
    setPlaying(!playing);
  };

  const { label: name, legend } = SAT_LAYERS[layer];
  const images = layer === "true" ? [...frames, live] : frames;
  const label =
    pick === LIVE
      ? `${fmtDate(sgDate(0, new Date(live.time)))}, ${fmtTime(live.time)}`
      : `${fmtDate(frames[pick].time)}, about 1:30pm`;

  return (
    <div className="px-4">
      <div role="group" aria-label="Choose layer" className="mb-2 flex gap-1 rounded-full bg-surface p-1">
        {(Object.keys(SAT_LAYERS) as SatLayer[]).map((key) => (
          <button key={key} onClick={() => switchLayer(key)} aria-pressed={layer === key} className={`${CHIP} flex-auto px-3 ${chipState(layer === key)}`}>
            {SAT_LAYERS[key].label}
          </button>
        ))}
      </div>

      <a href={images[pick].link} target="_blank" rel="noreferrer" className="relative block aspect-[1000/520] overflow-hidden rounded-2xl bg-line" aria-label="Open in NASA Worldview">
        {images.map((img, i) =>
          shown.has(i) || i === pick ? (
            // eslint-disable-next-line @next/next/no-img-element -- NASA serves sized images; no optimisation needed
            <img
              key={img.url}
              src={img.url}
              alt={i === pick ? `${name} satellite view of Sumatra, Singapore and Borneo, ${label}` : ""}
              width={1000}
              height={520}
              className={`absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${i === pick ? "opacity-100" : "opacity-0"}`}
            />
          ) : null,
        )}
        <SgPin />
        <span className="tabular absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white" aria-live="polite">
          {label}
        </span>
      </a>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play the last few days"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fg text-bg"
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden className="translate-x-px" />}
        </button>
        <div role="group" aria-label="Choose day" className="flex min-w-0 flex-1 gap-1 rounded-full bg-surface p-1">
          {images.map((img, i) => (
            <button key={img.url} onClick={() => choose(i)} aria-pressed={pick === i} className={`${CHIP} flex-1 ${chipState(pick === i)}`}>
              {i === LIVE ? "Now" : fmtWeekday(img.time)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[13px] text-muted">
        {pick === LIVE ? (
          <p>Black and white, every 10 minutes in daylight. Haze is the grey veil.</p>
        ) : "chips" in legend ? (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legend.chips.map(([color, chip]) => (
              <span key={chip} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
                {chip}
              </span>
            ))}
          </p>
        ) : (
          <>
            <p className="tabular flex items-center gap-2 text-[12px]">
              <span className="font-semibold">{legend.unit}</span>
              {legend.low}
              <span aria-hidden className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${legend.stops.join(", ")})` }} />
              {legend.high}
            </p>
            <p className="mt-1">{legend.note}</p>
          </>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted">
        NASA GIBS and Worldview (VIIRS, OMPS and AIRS); Himawari-9 from the Japan Meteorological Agency. Tap the image to explore.
      </p>
    </div>
  );
}
