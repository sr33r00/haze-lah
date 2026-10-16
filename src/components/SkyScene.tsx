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
/** Clear until t 0.2, clear to haze by 0.6, haze to dense smoke by 1. */
const ramp = (t: number, [clear, haze, smoke]: string[]) => (t <= 0.6 ? mix(clear, haze, clamp((t - 0.2) / 0.4)) : mix(haze, smoke, (t - 0.6) / 0.4));

const DAY_TOP = ["#b9d6e6", "#c4ad86", "#8e8374"];
const DAY_HORIZON = ["#e3eef3", "#ddc9a4", "#b3a690"];
const SUN = ["#fff4d6", "#e2662a", "#c94a1e"];

/**
 * Sky colours for a reading. t follows the square root of PM2.5 so each NEA band looks different;
 * h is the haze density that fades the rows, near zero for clean air.
 */
export function skyColors(pm25: number | null, night: boolean) {
  if (pm25 == null) return { t: 0.5, h: 0.35, top: night ? "#272c31" : "#b3b8bb", horizon: night ? "#3a4045" : "#cdd1d3" };
  const t = clamp(Math.sqrt(Math.max(0, pm25) / 250));
  const h = clamp((t - 0.15) / 0.85);
  if (night) return { t, h, top: mix("#16222c", "#3b342d", clamp(h / 0.7)), horizon: mix("#2a3640", "#57493b", clamp(h / 0.7)) };
  return { t, h, top: ramp(t, DAY_TOP), horizon: ramp(t, DAY_HORIZON) };
}

// Blocks as [x, width, top y, roof] in a 390 x 300 scene; nothing rises above y 82 so the text never meets a roof.
// Roof: 0 flat with water tank and lift motor room, 1 stepped, 2 pitched cap, 3 point block with a crown.
type Block = [number, number, number, number];
const FAR: Block[] = [
  [-4, 44, 132, 0],
  [44, 16, 98, 3],
  [64, 15, 110, 3],
  [86, 52, 126, 2],
  [142, 17, 92, 3],
  [163, 16, 104, 3],
  [186, 56, 122, 0],
  [246, 16, 88, 3],
  [266, 15, 100, 3],
  [286, 50, 128, 1],
  [340, 17, 96, 3],
  [361, 36, 118, 0],
];
const MID: Block[] = [
  [-8, 64, 150, 1],
  [60, 50, 138, 0],
  [114, 68, 158, 2],
  [186, 20, 120, 3],
  [210, 64, 146, 0],
  [278, 52, 162, 1],
  [334, 64, 142, 2],
];
const BACK: Block = [146, 100, 212, 1];
const NEAR: Block[] = [
  [-10, 128, 188, 0],
  [262, 140, 182, 2],
];
const TREES = [
  [112, 290, 9],
  [124, 284, 10],
  [137, 290, 8],
  [148, 293, 6],
  [244, 292, 6],
  [253, 287, 9],
  [262, 293, 6],
];
const DECK = 284; // void deck: the open ground floor of the near blocks

/** Deterministic 0..1 noise, so lit windows stay put between renders. */
const noise = (a: number, b: number) => (((Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0) % 1000) / 1000;

/** Window cells on a block's floor grid (aligned with its pattern), kept when noise is under `share`. */
function lit([x, w, top]: Block, cw: number, ch: number, bottom: number, share: number, seed: number) {
  const out: [number, number][] = [];
  for (let wx = Math.ceil((x + 3) / cw) * cw; wx + cw <= x + w - 2; wx += cw)
    for (let wy = Math.ceil((top + 4) / ch) * ch; wy + ch <= bottom; wy += ch) if (noise(wx + seed, wy) < share) out.push([wx, wy]);
  return out;
}

/** A flat HDB silhouette: body plus its roofline. Inherits fill from the parent group. */
function Shape({ b: [x, w, y, roof], bottom = 300 }: { b: Block; bottom?: number }) {
  return (
    <>
      <rect x={x} y={roof === 1 ? y + 10 : y} width={w} height={bottom - y} />
      {roof === 0 && (
        <>
          <rect x={x + w * 0.18} y={y - 5} width="9" height="5" />
          <rect x={x + w * 0.62} y={y - 8} width="8" height="8" />
        </>
      )}
      {roof === 1 && (
        <>
          <rect x={x + w * 0.35} y={y} width={w * 0.65} height="10" />
          <rect x={x + w * 0.7} y={y - 7} width="8" height="7" />
        </>
      )}
      {roof === 2 && <polygon points={`${x - 1},${y} ${x + 7},${y - 7} ${x + w - 7},${y - 7} ${x + w + 1},${y}`} />}
      {roof === 3 && <rect x={x + 3} y={y - 6} width={w - 6} height="6" />}
    </>
  );
}

/** Corridor stripes over a block's face, below its roofline. */
const face = ([x, w, y, roof]: Block, fill: string, bottom: number) => (
  <rect key={x} x={x + 2} y={y + (roof === 1 ? 13 : 3)} width={w - 4} height={bottom - y - (roof === 1 ? 13 : 3)} fill={fill} />
);

/** The view out of the window: an HDB skyline whose haze thickens with the 1-hr PM2.5. Decorative. */
export default function SkyScene({ pm25, night }: { pm25: number | null; night: boolean }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { t, h, top, horizon } = skyColors(pm25, night);
  const light = night ? "#f2c96b" : "#ffffff";
  const near = night ? "#0f161b" : "#2a3036";
  const back = mix(near, horizon, 0.12);
  const far = mix(night ? "#1c262e" : "#6a7880", horizon, 0.5);
  const mid = mix(night ? "#141d24" : "#48535b", horizon, 0.2 + 0.35 * h);
  const sun = mix(ramp(t, SUN), horizon, 0.3 * h);
  const sunY = 70 + 44 * h;
  const fade = (target: number) => ({ opacity: shown ? target : 1, transition: "opacity 1.4s ease-out" });
  const veil = (target: number) => ({ opacity: shown ? target : 0, transition: "opacity 1.4s ease-out" });
  const deck = night ? "#05080a" : "#15191c";

  return (
    <div aria-hidden className="absolute inset-0" style={{ background: top }}>
      <svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 block aspect-[390/300] w-full">
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={horizon} />
          </linearGradient>
          <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={horizon} stopOpacity="0" />
            <stop offset="0.25" stopColor={horizon} />
          </linearGradient>
          <radialGradient id={`${id}g`}>
            <stop offset="0" stopColor={sun} stopOpacity="0.8" />
            <stop offset="1" stopColor={sun} stopOpacity="0" />
          </radialGradient>
          {/* Common corridors: a lighter parapet band every floor, windows between. */}
          <pattern id={`${id}n`} width="8" height="9" patternUnits="userSpaceOnUse">
            <rect y="6" width="8" height="2.5" fill={mix(near, light, night ? 0.2 : 0.1)} />
            <rect x="2" y="1.5" width="3.5" height="3.5" fill={mix(near, light, 0.05)} />
          </pattern>
          <pattern id={`${id}b`} width="8" height="9" patternUnits="userSpaceOnUse">
            <rect y="6" width="8" height="2.5" fill={mix(back, light, night ? 0.18 : 0.1)} />
          </pattern>
          <pattern id={`${id}d`} width="6" height="7" patternUnits="userSpaceOnUse">
            <rect y="5" width="6" height="1.5" fill={mix(mid, light, night ? 0.15 : 0.12)} />
          </pattern>
          <mask id={`${id}m`}>
            <circle cx="318" cy="66" r="9" fill="#fff" />
            <circle cx="322" cy="62" r="8" fill="#000" />
          </mask>
        </defs>

        <rect width="390" height="300" fill={`url(#${id}s)`} />
        {pm25 != null && !night && (
          <g>
            <circle cx="326" cy={sunY} r={34 - 22 * h} fill={`url(#${id}g)`} opacity={1 - 0.8 * h} />
            <circle cx="326" cy={sunY} r={12 + 2 * h} fill={sun} />
          </g>
        )}
        {pm25 != null && night && <circle cx="318" cy="66" r="9" fill={mix("#e9e6da", "#c9a678", h)} opacity={1 - 0.6 * h} mask={`url(#${id}m)`} />}

        <g fill={far} style={fade(Math.max(0, 1 - 1.2 * h))}>
          {FAR.map((b) => (
            <Shape key={b[0]} b={b} />
          ))}
        </g>
        <rect y="80" width="390" height="220" fill={`url(#${id}v)`} style={veil(0.55 * h)} />

        <g style={fade(1 - 0.88 * h)}>
          <g fill={mid}>
            {MID.map((b) => (
              <Shape key={b[0]} b={b} />
            ))}
          </g>
          {MID.map((b) => face(b, `url(#${id}d)`, 300))}
          {night && (
            <g fill="#f2c96b" opacity="0.75">
              {MID.flatMap((b, i) =>
                lit(b, 6, 7, 300, 0.12, i * 31).map(([x, y]) => <rect key={`${i}-${x}-${y}`} x={x + 1.5} y={y + 1} width="3" height="3" />),
              )}
            </g>
          )}
        </g>

        <g fill={back}>
          <Shape b={BACK} bottom={DECK} />
        </g>
        {face(BACK, `url(#${id}b)`, DECK)}
        <rect y="80" width="390" height="220" fill={`url(#${id}v)`} style={veil(0.3 * h)} />

        <g fill={near}>
          {NEAR.map((b) => (
            <Shape key={b[0]} b={b} bottom={DECK} />
          ))}
        </g>
        {NEAR.map((b) => face(b, `url(#${id}n)`, DECK - 2))}
        {night && (
          <g fill="#f2c96b">
            {NEAR.flatMap((b, i) =>
              lit(b, 8, 9, DECK - 2, 0.16, i * 17).map(([x, y]) => <rect key={`${i}-${x}-${y}`} x={x + 2} y={y + 1.5} width="3.5" height="3.5" />),
            )}
          </g>
        )}

        {[BACK, ...NEAR].map(([x, w], i) => (
          <g key={x}>
            <rect x={x} y={DECK} width={w} height={297 - DECK} fill={deck} />
            {Array.from({ length: Math.floor(w / 14) + 1 }, (_, k) => (
              <rect key={k} x={x + 2 + k * ((w - 7) / Math.floor(w / 14))} y={DECK} width="3" height={297 - DECK} fill={i ? near : back} />
            ))}
          </g>
        ))}
        <g fill={near}>
          {TREES.map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} />
          ))}
          <rect y="297" width="390" height="3" />
        </g>
        <rect y="140" width="390" height="160" fill={`url(#${id}v)`} style={veil(0.4 * clamp((h - 0.5) / 0.5))} />
      </svg>
    </div>
  );
}
