"use client";

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

  return (
    <figure className="px-2">
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
            {BANDS.map(([a, b, c]) =>
              a < yMax ? <ReferenceArea key={a} y1={a} y2={Math.min(b, yMax)} fill={c} fillOpacity={0.1} stroke="none" ifOverflow="hidden" /> : null,
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
            <YAxis domain={[0, yMax]} ticks={[0, 55, 150, 250].filter((v) => v <= yMax)} tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={42} />
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
            <ReferenceLine x={nowT} stroke="var(--muted)" label={{ value: "Now", fontSize: 12, fill: "var(--muted)", position: "insideTopLeft" }} />
          </ComposedChart>
        </ResponsiveContainer>
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
