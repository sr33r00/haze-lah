"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEVEL_COLOR } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint, HourPoint } from "@/lib/types";

type Row = { t: number; obs?: number; fc?: number; band?: [number, number] };

export default function Chart({ observed, forecast }: { observed: HourPoint[]; forecast: ForecastPoint[] }) {
  const obs = observed.slice(-24);
  const rows: Row[] = obs.map((p) => ({ t: Date.parse(p.time), obs: Math.round(p.value) }));
  // Join the forecast line to the last observation.
  if (rows.length && forecast.length) {
    const last = rows[rows.length - 1];
    last.fc = last.obs;
    last.band = [last.obs!, last.obs!];
  }
  for (const p of forecast) rows.push({ t: Date.parse(p.time), fc: p.pm25, band: [p.low, p.high] });

  const nowT = obs.length ? Date.parse(obs[obs.length - 1].time) : Date.now();
  const top = Math.max(80, ...rows.map((r) => Math.max(r.obs ?? 0, r.band?.[1] ?? 0)));
  const yMax = Math.ceil((top * 1.05) / 25) * 25;

  // NEA 1-hr PM2.5 bands as background.
  const bands: [number, number, string][] = [
    [0, 55, LEVEL_COLOR[0]],
    [55, 150, LEVEL_COLOR[2]],
    [150, 250, LEVEL_COLOR[3]],
    [250, 10000, LEVEL_COLOR[4]],
  ];

  return (
    <div className="w-full">
      <div className="h-56">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
          {bands.map(([a, b, c]) =>
            a < yMax ? <ReferenceArea key={a} y1={a} y2={Math.min(b, yMax)} fill={c} fillOpacity={0.09} stroke="none" ifOverflow="hidden" /> : null,
          )}
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => fmtHour(t)}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            labelFormatter={(t) => fmtHour(t as number)}
            formatter={(v, name) => {
              if (name === "band") {
                const [lo, hi] = v as unknown as [number, number];
                return [`${lo}–${hi}`, "Likely range"];
              }
              return [v as number, name === "obs" ? "Measured" : "Forecast"];
            }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }}
          />
          <Area dataKey="band" stroke="none" fill="#64748b" fillOpacity={0.18} isAnimationActive={false} connectNulls />
          <Line dataKey="obs" stroke="var(--fg)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line dataKey="fc" stroke="var(--fg)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
          <ReferenceLine x={nowT} stroke="var(--muted)" strokeDasharray="3 3" label={{ value: "now", fontSize: 10, fill: "var(--muted)", position: "insideTopRight" }} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>━ measured (NEA)</span>
        <span>┅ forecast</span>
        <span>▒ likely range</span>
        <span style={{ color: LEVEL_COLOR[0] }}>■ normal ≤55</span>
        <span style={{ color: LEVEL_COLOR[2] }}>■ elevated</span>
        <span style={{ color: LEVEL_COLOR[3] }}>■ high &gt;150</span>
      </div>
    </div>
  );
}
