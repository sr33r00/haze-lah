"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { HIMAWARI_BANDS, HIMAWARI_SIZE, himawariTimes, himawariUrl, onImage, type HimawariBand } from "@/lib/satellite";
import { SG } from "@/lib/util";
import PlayButton from "./PlayButton";

const FRAME_MS = 250; // about 4 pictures a second
const BLANK_BELOW = 3; // a picture whose average brightness (0 to 255) is under this has no data
const SG_AT = onImage(SG.lat, SG.lon);

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

/** The pictures of one band, stacked so that the loop only swaps which one shows; empty ones are dropped. Keyed by band: it starts afresh for each. */
function Player({ band, times, playing, onPlaying }: { band: (typeof HIMAWARI_BANDS)[number]; times: string[]; playing: boolean; onPlaying: (on: boolean) => void }) {
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

  const note = settled && n === 0 ? (band.note ?? "Satellite pictures are unavailable right now.") : null;
  const mark = (t: string, s: Status) => setStatus((old) => ({ ...old, [t]: s }));
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: `${HIMAWARI_SIZE.w} / ${HIMAWARI_SIZE.h}` }}>
        <div role="img" aria-label={`${band.label} satellite pictures of Sumatra, Singapore and Borneo`} className="absolute inset-0">
          {times
            .filter((t) => status[t] !== "none" && status[t] !== "error")
            .map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t}
                src={himawariUrl(band.layer, t)}
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
          <div aria-hidden className="pointer-events-none absolute flex items-center gap-1.5" style={{ left: `${SG_AT.x}%`, top: `${SG_AT.y}%`, transform: "translate(-5px, -50%)" }}>
            <span className="size-2.5 shrink-0 rounded-full bg-white ring-2 ring-black/60" />
            <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">Singapore</span>
          </div>
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

/**
 * The last 3 hours of Himawari-9 over Sumatra, Singapore and Borneo as a looping picture, straight from NASA GIBS. Nothing loads until
 * the section is near the screen. Paused to begin with under reduced motion.
 */
export default function HimawariLoop() {
  const [band, setBand] = useState<HimawariBand>("infrared");
  const [playing, setPlaying] = useState(true);
  const [times, setTimes] = useState<string[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const start = () => setTimes(himawariTimes());
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

  const current = HIMAWARI_BANDS.find((b) => b.id === band)!;
  return (
    <div ref={box} className="px-4">
      <div role="group" aria-label="Satellite band" className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
        {HIMAWARI_BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={b.id === band}
            onClick={() => setBand(b.id)}
            className={`min-h-[44px] rounded-xl px-2 text-[14px] font-semibold ${b.id === band ? "bg-fg text-bg" : "text-muted hover:bg-line"}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {times ? (
        <Player key={band} band={current} times={times} playing={playing} onPlaying={setPlaying} />
      ) : (
        <div className="animate-pulse rounded-2xl bg-line" style={{ aspectRatio: `${HIMAWARI_SIZE.w} / ${HIMAWARI_SIZE.h}` }} />
      )}
      <p className="mt-2 text-[13px] text-muted">Himawari-9 (JMA), via NASA GIBS</p>
    </div>
  );
}
