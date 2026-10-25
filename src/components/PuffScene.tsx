import { useId, type CSSProperties } from "react";
import type { Step } from "@/lib/bands";
import Puff, { puffMood, type PuffMood } from "./Puff";
import { fadeLayers, useLeaving } from "./puffFade";

// The scene is drawn in Puff's own units (0..128 by 0..112) but reaches past them, so the haze can drift around the cloud.
const VIEW = { x: -50, y: -44, w: 228, h: 190 };
const PUFF = { w: 128, h: 112 };
const SUN = { x: 94, y: 10 };
const SMOKE = "#d8c7b8";

type Drift = { x: number; y: number; dx: number; dy: number; secs: number; delay: number; o: number };
type Wisp = Drift & { rx: number; ry: number };
type Mote = Drift & { r: number };

// Wisps are long soft ovals that drift sideways; motes are small specks that rise. Negative delays start them mid-loop.
const WISPS: Partial<Record<PuffMood, Wisp[]>> = {
  uneasy: [
    { x: 4, y: 82, rx: 42, ry: 9, dx: 26, dy: -3, secs: 16, delay: -5, o: 1 },
    { x: 132, y: 26, rx: 34, ry: 8, dx: -22, dy: 2, secs: 13, delay: -9, o: 0.9 },
    { x: 126, y: 100, rx: 38, ry: 9, dx: 20, dy: -3, secs: 19, delay: -1, o: 0.8 },
  ],
  worried: [
    { x: 4, y: 80, rx: 44, ry: 10, dx: 28, dy: -3, secs: 15, delay: -4, o: 1 },
    { x: 134, y: 24, rx: 38, ry: 9, dx: -24, dy: 2, secs: 12, delay: -8, o: 0.9 },
    { x: 126, y: 98, rx: 42, ry: 10, dx: 22, dy: -4, secs: 18, delay: -2, o: 0.9 },
    { x: 70, y: -22, rx: 36, ry: 8, dx: 24, dy: 2, secs: 17, delay: -11, o: 0.7 },
    { x: 20, y: 118, rx: 36, ry: 8, dx: -22, dy: -2, secs: 14, delay: -6, o: 0.7 },
  ],
  sad: [
    { x: 2, y: 78, rx: 52, ry: 13, dx: 26, dy: -3, secs: 17, delay: -5, o: 1 },
    { x: 134, y: 22, rx: 46, ry: 12, dx: -22, dy: 3, secs: 14, delay: -10, o: 1 },
    { x: 124, y: 96, rx: 50, ry: 13, dx: 22, dy: -3, secs: 20, delay: -2, o: 1 },
    { x: 66, y: -24, rx: 44, ry: 11, dx: 24, dy: 2, secs: 16, delay: -12, o: 0.9 },
    { x: 18, y: 122, rx: 46, ry: 11, dx: -24, dy: -2, secs: 15, delay: -7, o: 0.9 },
  ],
};
const MOTES: Partial<Record<PuffMood, Mote[]>> = {
  worried: [
    { x: 118, y: 66, r: 1.5, dx: 6, dy: -16, secs: 10, delay: -3, o: 0.6 },
    { x: 10, y: 44, r: 1.2, dx: -5, dy: -14, secs: 12, delay: -7, o: 0.5 },
    { x: 128, y: 6, r: 1.3, dx: 5, dy: -12, secs: 9, delay: -1, o: 0.5 },
  ],
  sad: [
    { x: 118, y: 70, r: 1.8, dx: 7, dy: -16, secs: 10, delay: -3, o: 0.75 },
    { x: 8, y: 50, r: 1.4, dx: -6, dy: -14, secs: 12, delay: -7, o: 0.6 },
    { x: 130, y: 8, r: 1.6, dx: 6, dy: -12, secs: 9, delay: -1, o: 0.65 },
    { x: 24, y: 104, r: 1.5, dx: -5, dy: -14, secs: 11, delay: -5, o: 0.6 },
    { x: 102, y: 100, r: 2, dx: 6, dy: -18, secs: 13, delay: -9, o: 0.9 },
    { x: 56, y: -6, r: 1.3, dx: 4, dy: -12, secs: 8, delay: -2, o: 0.55 },
  ],
};

type DriftStyle = CSSProperties & { "--dx": string; "--dy": string };
const drift = (d: Drift): DriftStyle => ({ animationDuration: `${d.secs}s`, animationDelay: `${d.delay}s`, "--dx": `${d.dx}px`, "--dy": `${d.dy}px` });

/** A long soft oval, built from two overlapping radial gradients, drifting sideways. */
function WispShape({ w, fill }: { w: Wisp; fill: string }) {
  return (
    <g opacity={w.o}>
      <g className="animate-puff-drift" style={drift(w)}>
        <ellipse cx={w.x} cy={w.y} rx={w.rx} ry={w.ry} fill={fill} />
        <ellipse cx={w.x + w.rx * 0.3} cy={w.y - w.ry * 0.7} rx={w.rx * 0.55} ry={w.ry * 0.8} fill={fill} />
      </g>
    </g>
  );
}

/** Sun rays: thin wedges, alternately long and short. */
function rays(n: number, inner: number, outer: number, short: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const half = (Math.PI / n) * 0.34;
    const r2 = i % 2 ? short : outer;
    const p = (r: number, t: number) => `${(SUN.x + r * Math.cos(t)).toFixed(1)} ${(SUN.y + r * Math.sin(t)).toFixed(1)}`;
    return `M${p(inner, a - half * 1.6)}L${p(r2, a - half * 0.5)}L${p(r2, a + half * 0.5)}L${p(inner, a + half * 1.6)}Z`;
  }).join("");
}
const RAYS = rays(16, 12, 56, 42);

/** What a mood draws behind Puff. Fills use the panel's own ink (currentColor) or a warm grey, so they read on every verdict colour. */
function Haze({ mood, uid }: { mood: PuffMood; uid: string }) {
  const wisps = WISPS[mood] ?? [];
  const motes = MOTES[mood] ?? [];
  const fill = `url(#${uid}-${mood === "sad" ? "smoke" : "ink"})`;
  return (
    <>
      {mood === "sad" && <ellipse cx="64" cy="58" rx="112" ry="84" fill={`url(#${uid}-dim)`} />}
      {mood === "happy" && (
        <>
          <circle cx={SUN.x} cy={SUN.y} r="46" fill={`url(#${uid}-halo)`} />
          <g className="animate-puff-sun">
            <path d={RAYS} fill={`url(#${uid}-rays)`} />
          </g>
          <circle cx={SUN.x} cy={SUN.y} r="15" fill={`url(#${uid}-sun)`} />
        </>
      )}
      {mood === "sleepy" && (
        <g transform="translate(16 8) scale(1.1)">
          <circle r="28" fill={`url(#${uid}-moonglow)`} />
          <g className="animate-puff-float" style={{ animationDuration: "7s", "--puff-lift": "2px" } as CSSProperties}>
            <circle r="12" fill="#f3c654" mask={`url(#${uid}-moon)`} />
          </g>
        </g>
      )}
      {wisps.map((w) => (
        <WispShape key={`${w.x}-${w.y}`} w={w} fill={fill} />
      ))}
      {motes.map((m) => (
        <g key={`${m.x}-${m.y}`} opacity={m.o}>
          <circle className="animate-puff-drift" style={drift(m)} cx={m.x} cy={m.y} r={m.r} fill={mood === "sad" ? SMOKE : "currentColor"} />
        </g>
      ))}
    </>
  );
}

/**
 * The haze scene behind Puff: a sun for good air, then more wisps and specks as the air gets worse, a crescent moon when asleep.
 * It follows the mood Puff shows, cross-fades when that changes, and moves with transform and opacity only. Decorative: size it
 * to Puff's box with `PuffStage`, and let the parent clip it.
 */
export function PuffScene({ step }: { step: Step | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { mood } = puffMood(step);
  const gone = useLeaving(mood);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const style: CSSProperties = { left: pct(VIEW.x, PUFF.w), top: pct(VIEW.y, PUFF.h), width: pct(VIEW.w, PUFF.w), height: pct(VIEW.h, PUFF.h) };
  return (
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} aria-hidden="true" className="pointer-events-none absolute select-none" style={style}>
      <defs>
        <radialGradient id={`${uid}-ink`}>
          <stop offset="0" stopColor="currentColor" stopOpacity=".34" />
          <stop offset=".5" stopColor="currentColor" stopOpacity=".14" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <mask id={`${uid}-moon`} maskUnits="userSpaceOnUse" x="-14" y="-14" width="28" height="28">
          <circle r="12" fill="#fff" />
          <circle cx="6.5" cy="-3.5" r="10" fill="#000" />
        </mask>
        <radialGradient id={`${uid}-moonglow`}>
          <stop offset="0" stopColor="#f3c654" stopOpacity=".26" />
          <stop offset="1" stopColor="#f3c654" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-smoke`}>
          <stop offset="0" stopColor={SMOKE} stopOpacity=".5" />
          <stop offset=".5" stopColor={SMOKE} stopOpacity=".24" />
          <stop offset="1" stopColor={SMOKE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-dim`}>
          <stop offset="0" stopColor="#2a0806" stopOpacity=".34" />
          <stop offset=".6" stopColor="#2a0806" stopOpacity=".16" />
          <stop offset="1" stopColor="#2a0806" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0" stopColor="#ffd56a" stopOpacity=".55" />
          <stop offset=".45" stopColor="#ffd56a" stopOpacity=".2" />
          <stop offset="1" stopColor="#ffd56a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-rays`} gradientUnits="userSpaceOnUse" cx={SUN.x} cy={SUN.y} r="56">
          <stop offset=".2" stopColor="#fff0b0" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff0b0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-sun`} cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset="1" stopColor="#ffc94d" />
        </radialGradient>
      </defs>
      {fadeLayers(mood, gone, (m) => (
        <Haze mood={m} uid={uid} />
      ))}
    </svg>
  );
}

/**
 * Puff on her haze scene, in a fixed box that sits to the right of the headline. `className` sets the width (default: 108 px on the
 * smallest phones, 120 px on phones, 220 px from `lg`). The scene reaches beyond the box, so put it where the parent clips overflow.
 */
export function PuffStage({ step, className = "w-[108px] min-[390px]:w-[120px] lg:w-[220px]" }: { step: Step | null; className?: string }) {
  return (
    <div className={`relative shrink-0 self-center ${className}`}>
      <PuffScene step={step} />
      <Puff step={step} className="relative w-full" />
    </div>
  );
}
