"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PM25_BANDS, PM25_COLORS, pm25Color } from "@/lib/bands";
import { fmtHour, fmtWeekday } from "@/lib/format";
import { HIGH_PM25 } from "@/lib/forecast";
import { peakAhead, readoutLines, type InstrumentHour } from "@/lib/forecastHours";
import { FIRE_COLOR } from "@/lib/replay";
import { sgDate, sgHour } from "@/lib/util";
import Readout from "./Readout";

const HOUR = 3600_000;
const PAD = 14; // px kept free at the left of the plot
const PAD_R = 28; // and at the right, where the 55 line is labelled
const WIDE = 640; // px; from this width the PM2.5 lane is taller (the wrapper's `@[640px]` class below says the same in CSS)
const LANE = { pm: 140, pmWide: 200, wind: 28, rain: 22 } as const; // px
const GAP = { pmWind: 8, windRain: 4 } as const;
const AXIS_H = 22;
/** Height of the whole SVG at a plot-lane height; the wrapper reserves it by CSS before the first measure, so nothing jumps. */
const heightFor = (pmH: number) => 6 + pmH + GAP.pmWind + LANE.wind + GAP.windRain + LANE.rain + AXIS_H;
const SERIES_GAP = 1.5 * HOUR; // a longer hole in the hours breaks a line instead of bridging it
const HALO = { stroke: "var(--bg)", strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke" } as const; // so a label reads on a line
const Y_TICKS = [20, 40, 100, 150, 200, 300, 400, 500, 600, 800]; // µg/m³ values the PM2.5 lane may label at its right edge
const TICK_GAP = 22; // px kept between two tick labels, and between a label and the 55 line's
/** The line under the instrument that says how to read it. */
const KEY = "Solid: measured. Dashed: forecast. Shade: likely range. PM2.5 forecast: Copernicus CAMS, calibrated to NEA readings.";
const LABEL = { fontSize: 11, fill: "var(--muted)" } as const;

type Pt = [number, number];

/** Cuts a series of [time, point] pairs into runs with no hole longer than SERIES_GAP. */
function runs(pts: { t: number; p: Pt }[]) {
  const out: { t: number; p: Pt }[][] = [];
  for (const q of pts) {
    const last = out.at(-1);
    if (last && q.t - last[last.length - 1].t <= SERIES_GAP) last.push(q);
    else out.push([q]);
  }
  return out;
}

const path = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

/** An arrow pointing the way the wind blows: it comes from `deg`, so it goes the opposite way (`deg + 180`). */
function Arrow({ x, y, deg, color }: { x: number; y: number; deg: number; color: string }) {
  return <path d="M0,-8V8M-4.5,-3.5L0,-8L4.5,-3.5" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${x.toFixed(1)} ${y}) rotate(${deg + 180})`} />;
}

/**
 * The 48-hour instrument: PM2.5 (measured, forecast and likely range over the NEA bands), the wind and the rain chance on one
 * shared time axis, with a readout above. Touch, drag or the arrow keys pick an hour; it opens on the forecast peak.
 * `windFailed` says the wind outlook could not be loaded, so its lane says so instead of showing arrows.
 */
export default function Instrument({ hours, windFailed }: { hours: InstrumentHour[]; windFailed: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const present = hours.length > 0; // the box exists only then
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [present]);

  const times = useMemo(() => hours.map((h) => Date.parse(h.t)), [hours]);
  const nowIdx = useMemo(() => hours.findLastIndex((h) => h.observed != null), [hours]);
  const peakT = useMemo(() => peakAhead(hours)?.t, [hours]);

  if (!hours.length) return <p className="text-[15px] text-muted">The forecast is not available right now.</p>;

  const t0 = times[0];
  const span = Math.max(HOUR, times[times.length - 1] - t0);
  const plotW = Math.max(0, w - PAD - PAD_R);
  const x = (t: number) => PAD + ((t - t0) / span) * plotW;

  const found = hours.findIndex((h) => h.t === (picked ?? peakT));
  const idx = found >= 0 ? found : Math.max(0, nowIdx);
  const setIdx = (i: number) => setPicked(hours[Math.min(hours.length - 1, Math.max(0, i))].t);
  const fromPointer = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    const t = t0 + ((clientX - rect.left - PAD) / Math.max(1, plotW)) * span;
    setIdx(times.reduce((best, ti, i) => (Math.abs(ti - t) < Math.abs(times[best] - t) ? i : best), 0));
  };

  // The wind step nearest the chosen hour, so the readout can say what the air is doing then (steps are 3 h apart).
  const near = windFailed
    ? null
    : hours.reduce<number | null>((best, h, i) => {
        const d = Math.abs(times[i] - times[idx]);
        return h.wind && h.pm25 != null && d <= 1.5 * HOUR && (best == null || d < Math.abs(times[best] - times[idx])) ? i : best;
      }, null);
  const shown: InstrumentHour = { ...hours[idx], wind: hours[idx].pm25 != null && near != null ? hours[near].wind : null };

  // Geometry: three lanes, top to bottom, then the axis.
  const wide = w >= WIDE;
  const pmH = wide ? LANE.pmWide : LANE.pm;
  const pmY = 6;
  const windY = pmY + pmH + GAP.pmWind;
  const rainY = windY + LANE.wind + GAP.windRain;
  const bottom = rainY + LANE.rain;
  const height = heightFor(pmH);
  const peakVal = Math.max(0, ...hours.flatMap((h) => [h.pm25, h.high, h.observed].filter((v): v is number => v != null)));
  const yMax = Math.max(80, Math.ceil((peakVal * 1.1) / 10) * 10);
  const y = (v: number): number => pmY + pmH - (Math.min(v, yMax) / yMax) * pmH;

  const forecast = runs(hours.flatMap((h, i) => (h.pm25 != null ? [{ t: times[i], p: [x(times[i]), y(h.pm25)] as Pt }] : [])));
  // The dashed line starts where the solid one ends, so the hour between them is not left blank.
  const last = nowIdx >= 0 && hours[nowIdx].pm25 == null ? { t: times[nowIdx], p: [x(times[nowIdx]), y(hours[nowIdx].observed!)] as Pt } : null;
  if (last && forecast[0] && forecast[0][0].t - last.t <= SERIES_GAP) forecast[0].unshift(last);
  const measured = runs(hours.flatMap((h, i) => (h.observed != null ? [{ t: times[i], p: [x(times[i]), y(h.observed)] as Pt }] : [])));
  const ribbon = runs(hours.flatMap((h, i) => (h.low != null && h.high != null ? [{ t: times[i], p: [h.low, h.high] as Pt }] : []))).map((r) => [
    ...r.map((q) => [x(q.t), y(q.p[1])] as Pt),
    ...r.map((q) => [x(q.t), y(q.p[0])] as Pt).reverse(),
  ]);
  const sel = hours[idx];
  const selV = sel.pm25 ?? sel.observed;
  const selX = x(times[idx]);
  const nowX = nowIdx >= 0 ? x(times[nowIdx]) : null;
  const barW = Math.max(1, (plotW * HOUR) / span - 1.5);
  const ticks = hours.flatMap((h, i) => (sgHour(h.t) % 6 === 0 ? [{ h, x: x(times[i]), midnight: sgHour(h.t) === 0 }] : []));
  // Up to three value labels at the right edge, clear of the 55 line, the top and each other.
  const yTicks = Y_TICKS.reduce<number[]>((kept, v) => {
    const clear = [HIGH_PM25, ...kept].every((k) => Math.abs(y(v) - y(k)) >= TICK_GAP);
    return v < yMax && y(v) - pmY >= 8 && kept.length < 3 && clear ? [...kept, v] : kept;
  }, []);
  const bands = PM25_BANDS.map((b, i) => ({ lo: i ? PM25_BANDS[i - 1].max : 0, hi: Math.min(b.max, yMax), color: PM25_COLORS[i] })).filter((b) => b.lo < yMax);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setIdx(e.key === "Home" ? 0 : e.key === "End" ? hours.length - 1 : idx + step);
  };

  return (
    <div>
      <Readout hour={shown} />
      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Hour of the 48-hour forecast"
        aria-valuemin={0}
        aria-valuemax={hours.length - 1}
        aria-valuenow={idx}
        aria-valuetext={readoutLines(shown).when}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e.clientX)}
        style={{ "--h": `${heightFor(LANE.pm)}px`, "--h-wide": `${heightFor(LANE.pmWide)}px` } as React.CSSProperties}
        className="@container mt-2 w-full cursor-ew-resize touch-pan-y select-none rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        <div className="h-[var(--h)] @[640px]:h-[var(--h-wide)]">
          <svg width={w} height={height} className="tabular block" aria-hidden>
            {w > 0 && (
              <>
                {bands.map((b, i) => (
                  <rect key={i} x={PAD} width={plotW} y={y(b.hi)} height={y(b.lo) - y(b.hi)} fill={b.color} fillOpacity={0.14} />
                ))}
                {ticks.map(({ x: tx, midnight }, i) => (
                  <line key={i} x1={tx} x2={tx} y1={pmY} y2={bottom} stroke={midnight ? "var(--muted)" : "var(--line)"} strokeOpacity={midnight ? 0.45 : 1} />
                ))}
                <line x1={PAD} x2={PAD + plotW} y1={y(HIGH_PM25)} y2={y(HIGH_PM25)} stroke="var(--muted)" strokeDasharray="4 4" />
                <text x={PAD + plotW + 5} y={y(HIGH_PM25) + 4} {...LABEL}>
                  {HIGH_PM25}
                </text>
                {yTicks.map((v) => (
                  <text key={v} x={PAD + plotW + 5} y={y(v) + 3.5} fontSize={10} fill="var(--muted)" fillOpacity={0.8}>
                    {v}
                  </text>
                ))}
                {ribbon.map((r, i) => (
                  <path key={i} d={`${path(r)}Z`} fill="var(--fg)" fillOpacity={0.18} />
                ))}
                {measured.map((r, i) => (
                  <path key={i} d={path(r.map((q) => q.p))} fill="none" stroke="var(--fg)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {forecast.map((r, i) => (
                  <path key={i} d={path(r.map((q) => q.p))} fill="none" stroke="var(--fg)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
                ))}
                {nowX != null && (
                  <>
                    <line x1={nowX} x2={nowX} y1={pmY} y2={pmY + pmH} stroke="var(--fg)" strokeOpacity={0.6} />
                    <text x={nowX + (nowX > w - 44 ? -4 : 4)} y={pmY + pmH - 6} textAnchor={nowX > w - 44 ? "end" : "start"} {...LABEL} {...HALO}>
                      Now
                    </text>
                  </>
                )}
                {windFailed ? (
                  <text x={PAD} y={windY + LANE.wind / 2 + 4} {...LABEL}>
                    Wind outlook unavailable
                  </text>
                ) : (
                  <>
                    <text x={PAD} y={windY + LANE.wind / 2 + 4} {...LABEL}>
                      Wind
                    </text>
                    {hours.map((h, i) =>
                      h.wind && h.pm25 != null ? <Arrow key={h.t} x={x(times[i])} y={windY + LANE.wind / 2} deg={h.wind.deg} color={h.wind.near > 0 ? FIRE_COLOR : "var(--muted)"} /> : null,
                    )}
                  </>
                )}
                <line x1={PAD} x2={PAD + plotW} y1={bottom} y2={bottom} stroke="var(--line)" />
                {hours.map((h, i) =>
                  h.rainProb != null && h.rainProb > 0 ? (
                    <rect key={h.t} x={x(times[i]) - barW / 2} width={barW} y={bottom - (h.rainProb / 100) * LANE.rain} height={(h.rainProb / 100) * LANE.rain} fill="var(--accent)" fillOpacity={0.45} />
                  ) : null,
                )}
                <text x={PAD} y={rainY + 10} {...LABEL} {...HALO}>
                  Rain
                </text>
                {ticks.map(({ h, x: tx, midnight }, i) => (
                  <text key={i} x={tx} y={bottom + 16} textAnchor={tx < PAD + 10 ? "start" : tx > w - PAD_R - 10 ? "end" : "middle"} {...LABEL} fontWeight={midnight ? 700 : 400} fill={midnight ? "var(--fg)" : "var(--muted)"}>
                    {midnight ? fmtWeekday(sgDate(0, new Date(h.t))) : fmtHour(h.t)}
                  </text>
                ))}
                <line x1={selX} x2={selX} y1={pmY} y2={bottom} stroke="var(--fg)" />
                {selV != null && <circle cx={selX} cy={y(selV)} r={5.5} fill={pm25Color(selV)} stroke="var(--bg)" strokeWidth={2} />}
              </>
            )}
          </svg>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted">{KEY}</p>
    </div>
  );
}
