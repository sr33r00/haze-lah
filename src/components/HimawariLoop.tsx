"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDateTime, fmtTimeRange } from "@/lib/format";
import { AHEAD_LABEL, AHEAD_NONE, FIRE_COLOR, NEW_FIRE_COLOR, aheadParts, fetchReplay, newFires, newZonesText, trailCaption } from "@/lib/replay";
import { HIMAWARI_SIZE, himawariUrl, onImage, visibleTimes } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { SG, sgDate } from "@/lib/util";
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

/** The pictures of the loop, stacked so that the loop only swaps which one shows (`current`). `mark` reports how each one loaded; without it the pictures are ones already loaded and served from the cache. */
function Frames({ times, current, mark }: { times: string[]; current: string | undefined; mark?: (t: string, s: Status) => void }) {
  return (
    <span role="img" aria-label="Visible-light satellite pictures of Sumatra, Singapore and Borneo" className="absolute inset-0 block">
      {times.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t}
          src={himawariUrl(t)}
          alt=""
          crossOrigin="anonymous"
          width={HIMAWARI_SIZE.w}
          height={HIMAWARI_SIZE.h}
          onLoad={mark && ((e) => mark(t, isBlank(e.currentTarget) ? "none" : "ok"))}
          onError={mark && (() => mark(t, "error"))}
          className={`absolute inset-0 size-full ${current === t ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </span>
  );
}

/** What fills the box of the picture, inline and full screen alike: the pictures, then `overlay`, with `badge` pinned to a corner (or `note` instead of both). Spans only, so it can sit inside a button. */
function Picture({ times, current, mark, note, overlay, badge }: { times: string[]; current: string | undefined; mark?: (t: string, s: Status) => void; note: string | null; overlay: React.ReactNode; badge: string | null }) {
  return (
    <>
      <Frames times={times} current={current} mark={mark} />
      {note ? (
        <span className="absolute inset-0 grid place-items-center p-4 text-center text-[15px] text-white/80">{note}</span>
      ) : (
        <>
          {overlay}
          {badge && <span className="tabular absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[13px] font-semibold text-white">{badge}</span>}
        </>
      )}
    </>
  );
}

/** Play/pause, the scrubber and the time of the picture shown. `onDark` suits the black full-screen view. */
function Controls({ playing, onPlaying, loading, n, at, onSeek, caption, onDark = false }: { playing: boolean; onPlaying: (on: boolean) => void; loading: boolean; n: number; at: number; onSeek: (i: number) => void; caption: string | null; onDark?: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <PlayButton playing={playing} onClick={() => onPlaying(!playing)} loading={loading} disabled={!loading && n < 2} what="satellite loop" className={onDark ? "bg-white text-black" : undefined} />
        <input
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={Math.max(0, at)}
          disabled={n < 2}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Picture time"
          className={`h-11 min-w-0 flex-1 ${onDark ? "accent-white" : "accent-[var(--accent)]"}`}
        />
      </div>
      {/* Announced only while paused: a loop at 4 pictures a second would read out every one. */}
      <p aria-live={playing ? "off" : "polite"} className="tabular mt-1 min-h-5 text-[15px] font-semibold">
        {caption}
      </p>
    </>
  );
}

/** The loop, and a button over its picture that opens the same loop full screen: a native dialog on black, panned and pinch-zoomed by scrolling, in step with the inline one (same picture, same play state). `overlay` is drawn over the pictures and `badge` pinned to a corner. */
function Player({ times, playing, onPlaying, overlay, badge }: { times: string[]; playing: boolean; onPlaying: (on: boolean) => void; overlay: React.ReactNode; badge: string | null }) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [pos, setPos] = useState(-1); // -1 is the newest picture
  const [full, setFull] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const have = times.filter((t) => status[t] === "ok");
  const settled = times.every((t) => status[t]);
  const n = have.length;
  const at = pos < 0 ? n - 1 : Math.min(pos, n - 1);

  useEffect(() => {
    if (!playing || !settled || n < 2) return;
    const id = setInterval(() => setPos((p) => (p + 1) % n), FRAME_MS);
    return () => clearInterval(id);
  }, [playing, settled, n]);

  // Where it opens on a phone, where the picture is wider than the screen: Singapore in the middle.
  useEffect(() => {
    const el = scroller.current;
    if (full && el) el.scrollLeft = ((el.scrollWidth * onImage(SG.lat, SG.lon).x) / 100) - el.clientWidth / 2;
  }, [full]);

  const note = settled && n === 0 ? "Satellite pictures are unavailable right now." : null;
  const mark = (t: string, s: Status) => setStatus((old) => ({ ...old, [t]: s }));
  const seek = (i: number) => {
    onPlaying(false);
    setPos(i);
  };
  const controls = { playing, onPlaying, loading: !settled, n, at, onSeek: seek, caption: n > 0 ? fmtDateTime(have[at]) : null };
  const close = () => dialog.current?.close();
  const backdrop = (e: React.MouseEvent) => e.target === e.currentTarget && close(); // the dialog itself, or the black around the picture
  const picture = { current: have[at], note, overlay, badge };
  return (
    <>
      <button
        type="button"
        aria-label="View full screen"
        disabled={n === 0}
        onClick={() => {
          setFull(true);
          dialog.current?.showModal();
        }}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-black disabled:cursor-default"
        style={{ aspectRatio: ASPECT }}
      >
        <Picture times={times.filter((t) => status[t] !== "none" && status[t] !== "error")} mark={mark} {...picture} />
        {n > 0 && (
          <span aria-hidden className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
            <Maximize2 size={16} />
          </span>
        )}
      </button>
      <div className="mt-3">
        <Controls {...controls} />
      </div>
      <dialog
        ref={dialog}
        aria-label="Satellite loop, full screen"
        onClose={() => setFull(false)}
        onClick={backdrop}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col overflow-hidden border-0 bg-black p-0 text-white open:flex backdrop:bg-black"
      >
        {full && (
          <>
            <div className="relative min-h-0 flex-1">
              {/* Wide enough to pan: on a phone held upright the picture is as tall as the screen; elsewhere it fits. touch-action leaves the browser's own pinch-zoom on. */}
              <div
                ref={scroller}
                tabIndex={0}
                aria-label="Satellite picture"
                onClick={backdrop}
                className="absolute inset-0 flex touch-pan-x touch-pan-y touch-pinch-zoom overflow-auto overscroll-contain [container-type:size]"
              >
                <div
                  className="relative m-auto w-[min(100cqw,calc(100cqh*var(--ar)))] shrink-0 pointer-coarse:portrait:h-[100cqh] pointer-coarse:portrait:w-auto"
                  style={{ aspectRatio: ASPECT, "--ar": HIMAWARI_SIZE.w / HIMAWARI_SIZE.h } as React.CSSProperties}
                >
                  <Picture times={have} {...picture} />
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                autoFocus
                aria-label="Close"
                className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20"
              >
                <X size={20} aria-hidden />
              </button>
              <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[13px] text-white pointer-coarse:block">Pinch to zoom</p>
            </div>
            <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:px-6">
              <Controls {...controls} onDark />
            </div>
          </>
        )}
      </dialog>
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
 * the afternoon's, up to 5:30pm), straight from NASA GIBS, with today's fires, the paths of today's smoke, province names and Singapore's PM2.5
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
          {frames?.night && <p className="mt-1 text-[13px] text-muted">Night: smoke can&apos;t be seen in the dark, so this is the last good light. Fires and smoke paths are the latest.</p>}
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
