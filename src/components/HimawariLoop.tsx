"use client";

import { useEffect, useState } from "react";
import { fmtDateTime, fmtTimeRange } from "@/lib/format";
import { AHEAD_LABEL, AHEAD_NONE, FIRE_COLOR, NEW_FIRE_COLOR, aheadParts, newZonesText, trailCaption } from "@/lib/replay";
import { SAT_SIZE, himawariUrl, visibleTimes } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { sgDate } from "@/lib/util";
import FullScreenPicture, { Chip, PictureNote, PictureSkeleton } from "./FullScreenPicture";
import PlayButton from "./PlayButton";
import SmokeOverlay, { Key, hasLayer, type SmokeLayer } from "./SmokeOverlay";

const FRAME_MS = 250; // about 4 pictures a second
const BLANK_BELOW = 3; // a picture whose average brightness (0 to 255) is under this has no data

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
          width={SAT_SIZE.w}
          height={SAT_SIZE.h}
          onLoad={mark && ((e) => mark(t, isBlank(e.currentTarget) ? "none" : "ok"))}
          onError={mark && (() => mark(t, "error"))}
          className={`absolute inset-0 size-full ${current === t ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </span>
  );
}

/** What fills the box of the picture, inline and full screen alike: the pictures, or `note` instead of them. Spans only, so it can sit inside a button. */
function Picture({ times, current, mark, note }: { times: string[]; current: string | undefined; mark?: (t: string, s: Status) => void; note: string | null }) {
  return (
    <>
      <Frames times={times} current={current} mark={mark} />
      {note && <PictureNote>{note}</PictureNote>}
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

/** The loop, and a button over its picture that opens the same loop full screen (`FullScreenPicture`), in step with the inline one (same picture, same play state). `overlay` is drawn over the pictures and `chips` pinned to their corners. */
function Player({ times, playing, onPlaying, overlay, chips }: { times: string[]; playing: boolean; onPlaying: (on: boolean) => void; overlay: React.ReactNode; chips: React.ReactNode }) {
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
  const seek = (i: number) => {
    onPlaying(false);
    setPos(i);
  };
  const controls = { playing, onPlaying, loading: !settled, n, at, onSeek: seek, caption: n > 0 ? fmtDateTime(have[at]) : null };
  const picture = { current: have[at], note };
  const over = note ? null : overlay;
  return (
    <>
      <FullScreenPicture
        name="Satellite loop"
        disabled={n === 0}
        inline={
          <>
            <Picture times={times.filter((t) => status[t] !== "none" && status[t] !== "error")} mark={mark} {...picture} />
            {over}
          </>
        }
        full={
          <>
            <Picture times={have} {...picture} />
            {over}
          </>
        }
        chips={note ? null : chips}
        controls={<Controls {...controls} onDark />}
      />
      <div className="mt-3">
        <Controls {...controls} />
      </div>
    </>
  );
}

/** The key of the loop (what the smoke, the cloud, the fires and the paths look like) and the note under it, for the sidebar of "Smoke from space". `fresh` are the new fire zones. */
export function LiveKey({ replay, fresh, layers }: { replay: Replay | null; fresh: [number, number][]; layers: Record<SmokeLayer, boolean> }) {
  return (
    <>
      <ul className="mt-1.5 space-y-1.5 text-[13px] text-muted">
        <Key mark={<span className="size-3.5 rounded-sm" style={{ background: "#9b8f84" }} />}>Smoke: smooth grey-brown veil, often over Sumatra and Borneo</Key>
        <Key mark={<span className="size-3.5 rounded-sm border border-fg/30 bg-white" />}>Cloud: bright white, lumpy</Key>
        {layers.fires && hasLayer(replay, "fires") && <Key mark={<span className="size-2.5 rounded-full" style={{ background: FIRE_COLOR }} />}>Fire seen by NASA today</Key>}
        {layers.fires && fresh.length > 0 && (
          <Key mark={<span className="size-3.5 rounded-full border-[1.5px]" style={{ borderColor: NEW_FIRE_COLOR }} />}>{newZonesText(fresh.length)}</Key>
        )}
        {layers.ahead && hasLayer(replay, "ahead") && <Key mark={<span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />}>{AHEAD_LABEL}</Key>}
      </ul>
      <p className="mt-2 text-[13px] text-muted">Fires and paths: latest, not the loop&apos;s time.</p>
    </>
  );
}

/**
 * The "Live" view of "Smoke from space": the last 3 hours of Himawari-9 over Sumatra, Singapore and Borneo as a looping picture (visible light
 * by day; at night the afternoon's, up to 5:30pm), straight from NASA GIBS, with today's fires, the paths of today's smoke, province names and
 * Singapore's PM2.5 (`pm25`, NEA's highest 1-hour reading) drawn over it, and a caption that says what it shows. The overlay is the latest data
 * (`replay`, or `failed` to get it, with its `fresh` fire zones and the `layers` that are on), not that of the loop's frame. Nothing loads until
 * `near`. Paused to begin with under reduced motion.
 */
export default function HimawariLoop({ pm25, replay, failed, fresh, layers, near }: { pm25: number | null; replay: Replay | null; failed: boolean; fresh: [number, number][]; layers: Record<SmokeLayer, boolean>; near: boolean }) {
  const [playing, setPlaying] = useState(true);
  const [frames, setFrames] = useState<ReturnType<typeof visibleTimes> | null>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);
  useEffect(() => {
    if (near) setFrames(visibleTimes());
  }, [near]);

  const day = replay?.days.at(-1);
  const reach = day?.ahead ? aheadParts(day.ahead) : null;
  const night = frames?.night ? `${sgDate(0, new Date(frames.times[0])) === sgDate(0) ? "Today" : "Yesterday"} ${fmtTimeRange(frames.times[0], frames.times.at(-1)!)}` : null;

  return (
    <>
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
      <div className="mt-3">
        {frames ? (
          <Player
            times={frames.times}
            playing={playing}
            onPlaying={setPlaying}
            chips={
              <>
                {night && <Chip at="top">{night}</Chip>}
                {layers.fires && hasLayer(replay, "fires") && <Chip at="bottom">Fires: today</Chip>}
              </>
            }
            overlay={<SmokeOverlay fires={day?.fires ?? []} ahead={day?.ahead?.path} layers={layers} reading={pm25 != null ? `PM2.5 ${Math.round(pm25)} µg/m³` : null} fresh={fresh} />}
          />
        ) : (
          <PictureSkeleton />
        )}
        {frames?.night && <p className="mt-1 text-[13px] text-muted">Night: smoke can&apos;t be seen in the dark, so this is the last good light. Fires and smoke paths are the latest.</p>}
      </div>
    </>
  );
}
