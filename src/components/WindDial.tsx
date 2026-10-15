import { SMOKE_SECTORS, SOURCE_COLOR, type SmokeSource } from "@/lib/context";

const C = 60;
const R = 44;
const pt = (deg: number, r: number): [number, number] => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)];
const wedge = ([a, b]: readonly [number, number]) => `M${C} ${C} L${pt(a, R)} A${R} ${R} 0 0 1 ${pt(b, R)} Z`;

/** Compass with the two smoke-source sectors and an arrow for the wind, pointing at Singapore. */
export default function WindDial({ windDir }: { windDir: number }) {
  return (
    <svg viewBox="0 0 120 120" width={120} height={120} role="img" aria-label={`Wind from ${Math.round(windDir)} degrees`} className="shrink-0">
      {(Object.keys(SMOKE_SECTORS) as SmokeSource[]).map((k) => (
        <path key={k} d={wedge(SMOKE_SECTORS[k])} fill={SOURCE_COLOR[k]} opacity={0.3} />
      ))}
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth={2} />
      {["N", "E", "S", "W"].map((l, i) => {
        const [x, y] = pt(i * 90, R + 9);
        return (
          <text key={l} x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--muted)">
            {l}
          </text>
        );
      })}
      <g transform={`rotate(${windDir} ${C} ${C})`} stroke="var(--fg)" fill="var(--fg)">
        <line x1={C} y1={C - 36} x2={C} y2={C - 8} strokeWidth={3} strokeLinecap="round" />
        <polygon points={`${C},${C - 3} ${C - 6},${C - 14} ${C + 6},${C - 14}`} stroke="none" />
      </g>
      <circle cx={C} cy={C} r={2.5} fill="var(--bg)" stroke="var(--fg)" strokeWidth={1.5} />
    </svg>
  );
}
