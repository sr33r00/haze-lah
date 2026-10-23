"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDateTime, fmtTimeRange } from "@/lib/format";
import { AHEAD_LABEL, AHEAD_NONE, FIRE_COLOR, NEW_FIRE_COLOR, aheadParts, fetchReplay, newFires, newZonesText, trailCaption } from "@/lib/replay";
import { HIMAWARI_SIZE, himawariUrl, visibleTimes } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { sgDate } from "@/lib/util";
import PlayButton from "./PlayButton";
import SmokeOverlay, { SMOKE_LAYERS, hasLayer, type SmokeLayer } from "./SmokeOverlay";

const FRAME_MS = 250; // about 4 pictures a second
const BLANK_BELOW = 3; // a picture whose average brightness (0 to 255) is under this has no data
const ASPECT = `${HIMAWARI_SIZE.w} / ${HIMAWARI_SIZE.h}`;

type Status = "ok" | "none" | "error";

/** Whether GIBS sent a black picture: it answers a time it has no picture for (the night, for the visible band) with 200 and black, not an error. */
function isBlank(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 25;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    return sum / ((px.length / 4) * 3) < BLANK_BELOW;
  } catch {
    return false; // a picture the page may not read is shown as it is
  }
}

/** The pictures of the loop, stacked so that the loop only swaps which one shows; empty ones are dropped. `overlay` is drawn over them and `badge` pinned to a corner. */
function Player({ times, playing, onPlaying, overlay, badge }: { times: string[]; playing: boolean; onPlaying: (on: boolean) => void; overlay: React.ReactNode; badge: string | null }) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [pos, setPos] = useState(-1); // -1 is the newest picture
  const have = times.filter((t) => status[t] === "ok");
  const settled = times.every((t) => status[t]);
  const n = have.length;
  const at = pos < 0 ? n - 1 : Math.min(pos, n - 1);

  useEffect(() => {
    if (!playing || !settled || n < 2) return;
    const id = setInterval(() => setPos((p) => (p + 1) % n), FRAME_MS);
    return () => clearInterval(id);
  }, [playing, settled, n]);

  const note = settled && n === 0 ? "Satellite pictures are unavailable right now." : null;
  const mark = (t: string, s: Status) => setStatus((old) => ({ ...old, [t]: s }));
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: ASPECT }}>
        <div role="img" aria-label="Visible-light satellite pictures of Sumatra, Singapore and Borneo" className="absolute inset-0">
          {times
            .filter((t) => status[t] !== "none" && status[t] !== "error")
            .map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t}
                src={himawariUrl(t)}
                alt=""
                crossOrigin="anonymous"
                width={HIMAWARI_SIZE.w}
                height={HIMAWARI_SIZE.h}
                onLoad={(e) => mark(t, isBlank(e.currentTarget) ? "none" : "ok")}
                onError={() => mark(t, "error")}
                className={`absolute inset-0 size-full ${have[at] === t ? "opacity-100" : "opacity-0"}`}
              />
            ))}
        </div>
        {note ? (
          <p className="absolute inset-0 grid place-items-center p-4 text-center text-[15px] text-white/80">{note}</p>
        ) : (
          <>
            {overlay}
            {badge && <p className="tabular absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[13px] font-semibold text-white">{badge}</p>}
          </>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <PlayButton playing={playing} onClick={() => onPlaying(!playing)} loading={!settled} disabled={settled && n < 2} what="satellite loop" />
        <input
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={Math.max(0, at)}
          disabled={n < 2}
          onChange={(e) => {
            onPlaying(false);
            setPos(Number(e.target.value));
          }}
          aria-label="Picture time"
          className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
        />
      </div>
      {/* Announced only while paused: a loop at 4 pictures a second would read out every one. */}
      <p aria-live={playing ? "off" : "polite"} className="tabular mt-1 min-h-5 text-[15px] font-semibold">
        {n > 0 && fmtDateTime(have[at])}
      </p>
    </>
  );
}

/** One line of the key: a `mark` and what it means. */
function Key({ mark, children }: { mark: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-[3px] flex h-3.5 w-5 shrink-0 items-center justify-center">
        {mark}
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * "Smoke from space": the last 3 hours of Himawari-9 over Sumatra, Singapore and Borneo as a looping picture (visible light by day; at night
 * the last daylight loop), straight from NASA GIBS, with today's fires, the paths of today's smoke, province names and Singapore's PM2.5
 * (`pm25`, NEA's highest 1-hour reading) drawn over it, and a caption that says what it shows. The overlay is the latest data, not that of
 * the loop's frame. Nothing loads until the section is near the screen. Paused to begin with under reduced motion.
 */
export default function HimawariLoop({ pm25 }: { pm25: number | null }) {
  const [playing, setPlaying] = useState(true);
  const [frames, setFrames] = useState<ReturnType<typeof visibleTimes> | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [failed, setFailed] = useState(false);
  const [layers, setLayers] = useState<Record<SmokeLayer, boolean>>({ fires: true, ahead: true, labels: true });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const start = () => {
      setFrames(visibleTimes());
      fetchReplay().then(setReplay, () => setFailed(true));
    };
    if (!("IntersectionObserver" in window)) return void start();
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        start();
        io.disconnect();
      },
      { rootMargin: "300px" },
    );
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const day = replay?.days.at(-1);
  const fresh = useMemo(() => (replay ? newFires(replay.days) : []), [replay]);
  const reach = day?.ahead ? aheadParts(day.ahead) : null;
  const shown = SMOKE_LAYERS.filter((l) => hasLayer(replay, l.id));
  const badge = frames?.night ? `${sgDate(0, new Date(frames.times[0])) === sgDate(0) ? "Today" : "Yesterday"} ${fmtTimeRange(frames.times[0], frames.times.at(-1)!)}` : null;

  return (
    <div ref={box} className="px-4">
      <div aria-live="polite" className={failed || day ? "" : "min-h-[5.5rem]"}>
        {day ? (
          <>
            <p className="text-[15px] font-bold text-fg">{trailCaption(day)}</p>
            {day.ahead && <p className="mt-1 text-[15px] text-fg">{reach ? [reach.reach, reach.source].filter(Boolean).join(" ") : AHEAD_NONE}</p>}
          </>
        ) : (
          !failed && <div className="h-[5.5rem] animate-pulse rounded-2xl bg-line" />
        )}
      </div>
      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
        <div>
          {frames ? (
            <Player
              times={frames.times}
              playing={playing}
              onPlaying={setPlaying}
              badge={badge}
              overlay={<SmokeOverlay replay={replay} layers={layers} pm25={pm25} fresh={fresh} />}
            />
          ) : (
            <div className="animate-pulse rounded-2xl bg-line" style={{ aspectRatio: ASPECT }} />
          )}
          {frames?.night && <p className="mt-1 text-[13px] text-muted">Night: smoke can&apos;t be seen in the dark, so this is the last daylight. Fires and smoke paths are the latest.</p>}
        </div>
        <div className="mt-3 lg:mt-0">
          {shown.length > 0 && (
            <div role="group" aria-label="Show on the picture" className={`mb-3 grid gap-1 rounded-2xl bg-surface p-1 ${shown.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {shown.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={layers[l.id]}
                  onClick={() => setLayers((old) => ({ ...old, [l.id]: !old[l.id] }))}
                  className={`min-h-[44px] rounded-xl px-2 text-[14px] font-semibold ${layers[l.id] ? "bg-fg text-bg" : "text-muted hover:bg-line"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
          <h3 className="text-[13px] font-semibold text-fg">How to read this</h3>
          <ul className="mt-1.5 space-y-1.5 text-[13px] text-muted">
            <Key mark={<span className="size-3.5 rounded-sm" style={{ background: "#9b8f84" }} />}>Smoke: smooth grey-brown veil, often over Sumatra and Borneo</Key>
            <Key mark={<span className="size-3.5 rounded-sm border border-fg/30 bg-white" />}>Cloud: bright white, lumpy</Key>
            {layers.fires && hasLayer(replay, "fires") && (
              <Key mark={<span className="size-2.5 rounded-full" style={{ background: FIRE_COLOR }} />}>Fire seen by NASA today</Key>
            )}
            {layers.fires && fresh.length > 0 && (
              <Key mark={<span className="size-3.5 rounded-full border-[1.5px]" style={{ borderColor: NEW_FIRE_COLOR }} />}>{newZonesText(fresh.length)}</Key>
            )}
            {layers.ahead && hasLayer(replay, "ahead") && (
              <Key mark={<span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />}>{AHEAD_LABEL}</Key>
            )}
          </ul>
          <p className="mt-2 text-[13px] text-muted">Fires and paths: latest, not the loop&apos;s time.</p>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted">Himawari-9 (JMA) via NASA GIBS · Fires: NASA FIRMS · Wind: ECMWF via Open-Meteo{pm25 != null && " · PM2.5: NEA"}</p>
    </div>
  );
}
