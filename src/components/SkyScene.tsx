import { useEffect, useId, useState } from "react";

// Hex colour helpers: mix(a, b, k) blends a towards b by k (0..1).
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (n: number) => `0${Math.round(n).toString(16)}`.slice(-2);
const mix = (a: string, b: string, k: number) => {
  const y = rgb(b);
  const c = rgb(a).map((v, i) => hex(v + (y[i] - v) * k));
  return `#${c.join("")}`;
};
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Clear to haze over t 0..0.6, haze to dense smoke over 0.6..1. */
const ramp = (t: number, [clear, haze, smoke]: string[]) => (t <= 0.6 ? mix(clear, haze, t / 0.6) : mix(haze, smoke, (t - 0.6) / 0.4));

const DAY_TOP = ["#b9d6e6", "#c4ad86", "#8e8374"];
const DAY_HORIZON = ["#e3eef3", "#ddc9a4", "#b3a690"];
const SUN = ["#fff4d6", "#e2662a", "#c94a1e"];

/** Sky colours for a reading; Hero uses `top` to fill the space above the scene. */
export function skyColors(pm25: number | null, night: boolean) {
  const t = pm25 == null ? 0.4 : clamp(pm25 / 250);
  if (pm25 == null) return { t, top: night ? "#272c31" : "#b3b8bb", horizon: night ? "#3a4045" : "#cdd1d3" };
  if (night) return { t, top: mix("#16222c", "#3b342d", clamp(t / 0.7)), horizon: mix("#2a3640", "#57493b", clamp(t / 0.7)) };
  return { t, top: ramp(t, DAY_TOP), horizon: ramp(t, DAY_HORIZON) };
}

// Building layouts as [x, width, top y] in a 390 x 230 scene. Far: HDB point blocks and slabs; mid: 12 to 16 storey slabs.
const FAR = [
  [-6, 40, 140],
  [30, 14, 126],
  [46, 13, 132],
  [64, 46, 146],
  [114, 15, 124],
  [131, 14, 130],
  [150, 50, 142],
  [204, 13, 125],
  [219, 15, 134],
  [240, 44, 148],
  [288, 14, 128],
  [304, 13, 124],
  [322, 46, 140],
  [372, 14, 130],
];
const MID = [
  [-6, 58, 160],
  [56, 44, 153],
  [104, 66, 166],
  [174, 40, 151],
  [218, 62, 162],
  [284, 46, 156],
  [334, 62, 168],
];
const NEAR = [
  [-8, 116, 180],
  [150, 92, 196],
  [272, 126, 176],
];
const TREES = Array.from({ length: 30 }, (_, i) => [i * 13.6 + ((i * 7) % 5), 220 - ((i * 5) % 4), 7 + ((i * 3) % 4)]);

/** Deterministic 0..1 noise, so lit windows stay put between renders. */
const noise = (a: number, b: number) => (((Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0) % 1000) / 1000;

/** Cells of a window grid (aligned with the pattern) inside a block, kept when noise is under `share`. */
function lit(b: number[], cw: number, ch: number, bottom: number, share: number, seed: number) {
  const [x, w, top] = b;
  const out: [number, number][] = [];
  for (let wx = Math.ceil((x + 3) / cw) * cw + 2; wx + cw <= x + w - 3; wx += cw)
    for (let wy = Math.ceil((top + 4) / ch) * ch + 2; wy + ch <= bottom; wy += ch) if (noise(wx + seed, wy) < share) out.push([wx, wy]);
  return out;
}

/** The view out of the window: an HDB skyline whose haze thickens with the 1-hr PM2.5. Decorative. */
export default function SkyScene({ pm25, night }: { pm25: number | null; night: boolean }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { t, top, horizon } = skyColors(pm25, night);
  const near = night ? "#0f161b" : "#2a3036";
  const far = mix(night ? "#1c262e" : "#6a7880", horizon, 0.5);
  const mid = mix(night ? "#141d24" : "#48535b", horizon, 0.2 + 0.35 * t);
  const sunY = 64 + 38 * t;
  const sun = ramp(t, SUN);
  const fade = (target: number) => ({ opacity: shown ? target : 1, transition: "opacity 1.4s ease-out" });
  const veil = (target: number) => ({ opacity: shown ? target : 0, transition: "opacity 1.4s ease-out" });

  return (
    <div aria-hidden className="absolute inset-0" style={{ background: top }}>
      <svg viewBox="0 0 390 230" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 block aspect-[390/230] w-full">
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={horizon} />
          </linearGradient>
          <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={horizon} stopOpacity="0" />
            <stop offset="0.3" stopColor={horizon} />
          </linearGradient>
          <radialGradient id={`${id}g`}>
            <stop offset="0" stopColor={sun} stopOpacity="0.8" />
            <stop offset="1" stopColor={sun} stopOpacity="0" />
          </radialGradient>
          <pattern id={`${id}w`} width="7" height="9" patternUnits="userSpaceOnUse">
            <rect x="2" y="2" width="3.5" height="4.5" fill={night ? "#18222a" : "#353d44"} />
          </pattern>
          <mask id={`${id}m`}>
            <circle cx="332" cy="62" r="9" fill="#fff" />
            <circle cx="336" cy="58" r="8" fill="#000" />
          </mask>
        </defs>

        <rect width="390" height="230" fill={`url(#${id}s)`} />
        {pm25 != null && !night && (
          <g>
            <circle cx="344" cy={sunY} r={34 - 16 * t} fill={`url(#${id}g)`} />
            <circle cx="344" cy={sunY} r={12 + 2 * t} fill={sun} />
          </g>
        )}
        {pm25 != null && night && <circle cx="332" cy="62" r="9" fill={mix("#e9e6da", "#c9a678", t)} opacity={1 - 0.6 * t} mask={`url(#${id}m)`} />}

        <g fill={far} style={fade(Math.max(0, 1 - 1.2 * t))}>
          {FAR.map(([x, w, y]) => (
            <rect key={x} x={x} y={y} width={w} height={230 - y} />
          ))}
        </g>
        <rect y="100" width="390" height="130" fill={`url(#${id}v)`} style={veil(0.55 * t)} />

        <g style={{ opacity: 1 - 0.6 * t }}>
          <g fill={mid}>
            {MID.map(([x, w, y], i) => (
              <g key={x}>
                <rect x={x} y={y} width={w} height={230 - y} />
                <rect x={x + w * (0.15 + (i % 3) * 0.08)} y={y - 6} width="9" height="6" />
                <rect x={x + w * 0.62} y={y - 9} width="7" height="9" />
              </g>
            ))}
          </g>
          {night && (
            <g fill="#f2c96b" opacity="0.75">
              {MID.flatMap((b, i) => lit(b, 6, 7, 222, 0.12, i * 31).map(([x, y]) => <rect key={`${i}-${x}-${y}`} x={x} y={y} width="2.5" height="3" />))}
            </g>
          )}
        </g>
        <rect y="100" width="390" height="130" fill={`url(#${id}v)`} style={veil(0.3 * t)} />

        <g fill={near}>
          {NEAR.map(([x, w, y]) => (
            <g key={x}>
              <rect x={x} y={y} width={w} height={230 - y} />
              <rect x={x - 2} y={y - 3} width={w + 4} height="3" />
            </g>
          ))}
        </g>
        {NEAR.map(([x, w, y]) => (
          <rect key={x} x={x + 3} y={y + 4} width={w - 6} height={206 - y} fill={`url(#${id}w)`} />
        ))}
        {night && (
          <g fill="#f2c96b">
            {NEAR.flatMap((b, i) => lit(b, 7, 9, 210, 0.16, i * 17).map(([x, y]) => <rect key={`${i}-${x}-${y}`} x={x} y={y} width="3.5" height="4.5" />))}
          </g>
        )}
        <g fill={near}>
          {TREES.map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} />
          ))}
          <rect y="222" width="390" height="8" />
        </g>
      </svg>
    </div>
  );
}
