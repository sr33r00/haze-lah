"use client";

import { useEffect, useRef } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEVEL_COLOR } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint, HourPoint } from "@/lib/types";

type Row = { t: number; obs?: number; fc?: number; cams?: number; band?: [number, number] };

// NEA 1-hr PM2.5 bands drawn behind the lines.
const BANDS: [number, number, string, string][] = [
  [0, 55, LEVEL_COLOR[0], "Normal"],
  [55, 150, LEVEL_COLOR[2], "Elevated"],
  [150, 250, LEVEL_COLOR[3], "High"],
  [250, 10000, LEVEL_COLOR[4], "Very high"],
];

const AXIS_W = 42;

/**
 * The past 24 hours and the next 48. On narrow screens the plot scrolls sideways under a fixed PM2.5 axis and opens
 * with "now" in view; on wide screens it fits.
 */
export default function Chart({ observed, forecast }: { observed: HourPoint[]; forecast: ForecastPoint[] }) {
  const obs = observed.slice(-24);
  const rows: Row[] = obs.map((p) => ({ t: Date.parse(p.time), obs: Math.round(p.value) }));
  if (rows.length && forecast.length) {
    const last = rows[rows.length - 1];
    last.fc = last.obs;
    last.band = [last.obs!, last.obs!];
  }
  for (const p of forecast) rows.push({ t: Date.parse(p.time), fc: p.pm25, cams: p.raw, band: [p.low, p.high] });

  const nowT = obs.length ? Date.parse(obs[obs.length - 1].time) : Date.now();
  const top = Math.max(80, ...rows.map((r) => Math.max(r.obs ?? 0, r.band?.[1] ?? 0)));
  const yMax = Math.ceil((top * 1.05) / 50) * 50;
  const yTicks = [0, 55, 150, 250].filter((v) => v <= yMax);

  const scroller = useRef<HTMLDivElement>(null);
  const span = rows.length > 1 ? [rows[0].t, rows[rows.length - 1].t] : null;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !span || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = ((nowT - span[0]) / (span[1] - span[0])) * el.scrollWidth - el.clientWidth * 0.3;
  }, [nowT, span?.[0], span?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure className="px-2">
      <div className="flex h-64 lg:h-80">
        {/* The axis on its own, so it stays put while the plot scrolls. Same height, margins and X axis room as the plot. */}
        <div className="shrink-0" style={{ width: AXIS_W }} aria-hidden>
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="t" tick={false} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, yMax]}
                ticks={yTicks}
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                width={AXIS_W}
              />
              <Line dataKey="obs" stroke="none" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div
          ref={scroller}
          tabIndex={0}
          aria-label="PM2.5 chart, past 24 hours and next 48. Scroll sideways for more."
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,#000_92%,transparent)] lg:[mask-image:none]"
        >
          <div className="h-full min-w-[860px] lg:min-w-0">
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                {BANDS.map(([a, b, c]) =>
                  a < yMax ? (
                    <ReferenceArea key={a} y1={a} y2={Math.min(b, yMax)} fill={c} fillOpacity={0.1} stroke="none" ifOverflow="hidden" />
                  ) : null,
                )}
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) => fmtHour(t)}
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis hide domain={[0, yMax]} ticks={yTicks} />
                <Tooltip
                  labelFormatter={(t) => fmtHour(t as number)}
                  formatter={(v, name) => {
                    if (name === "band") {
                      const [lo, hi] = v as unknown as [number, number];
                      return [`${lo} to ${hi}`, "Likely range"];
                    }
                    const label = name === "obs" ? "Measured by NEA" : name === "fc" ? "Forecast" : "Copernicus model, uncorrected";
                    return [v as number, label];
                  }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13, color: "var(--fg)" }}
                />
                <Area dataKey="band" stroke="none" fill="var(--fg)" fillOpacity={0.12} isAnimationActive={false} connectNulls />
                <Line dataKey="cams" stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="1 4" dot={false} isAnimationActive={false} />
                <Line dataKey="obs" stroke="var(--fg)" strokeWidth={2.75} dot={false} isAnimationActive={false} />
                <Line dataKey="fc" stroke="var(--fg)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                <ReferenceLine
                  x={nowT}
                  stroke="var(--muted)"
                  label={{ value: "Now", fontSize: 12, fill: "var(--muted)", position: "insideTopLeft" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-2 text-[12px] text-muted">
        <Key line="solid">Measured</Key>
        <Key line="dash">Forecast</Key>
        <Key line="area">Likely range</Key>
        <Key line="dot">Uncorrected model</Key>
        {BANDS.slice(0, 3).map(([a, , c, n]) => (
          <span key={a} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c, opacity: 0.6 }} />
            {n}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function Key({ line, children }: { line: "solid" | "dash" | "area" | "dot"; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="10" aria-hidden>
        {line === "area" ? (
          <rect x="0" y="1" width="18" height="8" rx="2" fill="currentColor" opacity=".2" />
        ) : (
          <line
            x1="0"
            y1="5"
            x2="18"
            y2="5"
            stroke="currentColor"
            strokeWidth={line === "solid" ? 2.5 : line === "dot" ? 1.5 : 2}
            strokeDasharray={line === "dash" ? "5 3" : line === "dot" ? "1 3" : undefined}
            className={line === "solid" || line === "dash" ? "text-fg" : ""}
          />
        )}
      </svg>
      {children}
    </span>
  );
}
