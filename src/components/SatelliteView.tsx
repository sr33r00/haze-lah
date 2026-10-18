"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { sgDate } from "@/lib/util";
import { SG_ON_IMAGE, type SatImage } from "@/lib/satellite";

const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-SG", { ...opts, timeZone: "Asia/Singapore" }).format(new Date(`${date}T12:00:00+08:00`));
const STEP_MS = 1200;

/** Satellite views of the region: the last few days in true colour with fires, then the latest Himawari image. */
export default function SatelliteView({ daily, live }: { daily: SatImage[]; live: SatImage }) {
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
  const togglePlay = () => {
    if (!playing) setShown(new Set(frames.map((_, i) => i)));
    if (!playing && pick === LIVE) setPick(0);
    setPlaying(!playing);
  };

  const images = [...frames, live];
  const label =
    pick === LIVE
      ? `${fmt(sgDate(0, new Date(live.time)), { weekday: "short", day: "numeric", month: "short" })}, ${fmtTime(live.time)}`
      : `${fmt(frames[pick].time, { weekday: "short", day: "numeric", month: "short" })}, about 1:30pm`;

  return (
    <div className="px-4">
      <a href={images[pick].link} target="_blank" rel="noreferrer" className="relative block aspect-[1000/520] overflow-hidden rounded-2xl bg-line" aria-label="Open in NASA Worldview">
        {images.map((img, i) =>
          shown.has(i) || i === pick ? (
            // eslint-disable-next-line @next/next/no-img-element -- NASA serves sized images; no optimisation needed
            <img
              key={img.url}
              src={img.url}
              alt={i === pick ? `Satellite image of Sumatra, Singapore and Borneo, ${label}` : ""}
              width={1000}
              height={520}
              className={`absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${i === pick ? "opacity-100" : "opacity-0"}`}
            />
          ) : null,
        )}
        <span
          aria-hidden
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${SG_ON_IMAGE.x}%`, top: `${SG_ON_IMAGE.y}%` }}
        />
        <span
          aria-hidden
          className="absolute -translate-y-1/2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white"
          style={{ left: `calc(${SG_ON_IMAGE.x}% + 12px)`, top: `${SG_ON_IMAGE.y}%` }}
        >
          Singapore
        </span>
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
            <button
              key={img.url}
              onClick={() => choose(i)}
              aria-pressed={pick === i}
              className={`min-h-[32px] min-w-0 flex-1 rounded-full text-[12px] font-semibold transition-colors ${pick === i ? "bg-fg text-bg" : "text-muted"}`}
            >
              {i === LIVE ? "Now" : fmt(img.time, { weekday: "short" })}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        {pick === LIVE ? (
          <span>Black and white, every 10 minutes in daylight. Haze is the grey veil.</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-[#a89a84]" />
              Smoke, grey-brown veil
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-[#e5322d]" />
              Fires
            </span>
          </>
        )}
      </p>
      <p className="mt-1 text-[12px] text-muted">NASA GIBS and Worldview; Himawari-9 from the Japan Meteorological Agency. Tap the image to explore.</p>
    </div>
  );
}
