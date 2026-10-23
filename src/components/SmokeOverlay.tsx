"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FIRE_COLOR, NEW_FIRE_COLOR, topAreas } from "@/lib/replay";
import { HIMAWARI_SIZE, onImage } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { SG } from "@/lib/util";

/** The layers of the picture that can be switched off, as the chips list them. */
export const SMOKE_LAYERS = [
  { id: "fires", label: "Fires" },
  { id: "ahead", label: "Smoke heading" },
  { id: "labels", label: "Labels" },
] as const;
export type SmokeLayer = (typeof SMOKE_LAYERS)[number]["id"];

const LABELLED_AREAS = 3; // provinces named: the ones with most fires today
const LABEL_GAP = { x: 80, y: 14 }; // px; a province label this close to an earlier one is left out
const HALO = { stroke: "rgb(0 0 0 / 0.75)", strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke" } as const; // so text reads on cloud and on dark land
const DARK = "rgb(0 0 0 / 0.45)";

/** Whether the replay has anything for the layer; a chip for a layer with nothing is not shown. */
export function hasLayer(replay: Replay | null, layer: SmokeLayer) {
  const day = replay?.days.at(-1);
  return layer === "ahead" ? (day?.ahead?.path.length ?? 0) > 1 : (day?.fires.length ?? 0) > 0;
}

/**
 * Today's fires, the paths of today's smoke and the names of the provinces with most fires, drawn over the satellite picture of `SAT_BOX`,
 * with the new fire zones (`fresh`), Singapore and its highest 1-hour PM2.5 (`pm25`). An SVG in the picture's own pixels (measured, so dots and text keep their size at
 * any width); whatever lies outside the picture is cut off. Meant to sit inside the picture's box: it ignores the pointer.
 */
export default function SmokeOverlay({ replay, layers, pm25, fresh }: { replay: Replay | null; layers: Record<SmokeLayer, boolean>; pm25: number | null; fresh: [number, number][] }) {
  const svg = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const h = (w * HIMAWARI_SIZE.h) / HIMAWARI_SIZE.w;
  const at = (lat: number, lon: number) => {
    const p = onImage(lat, lon);
    return { x: (p.x * w) / 100, y: (p.y * h) / 100 };
  };
  const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;

  const day = replay?.days.at(-1);
  const fires = useMemo(() => day?.fires ?? [], [day]);
  const areas = useMemo(() => topAreas(fires, LABELLED_AREAS), [fires]);
  const ahead = (day?.ahead?.path ?? []).map(([la, lo]) => Object.values(at(la, lo)).join(",")).join(" ");

  const labels: { name: string; x: number; y: number }[] = [];
  for (const a of areas) {
    const p = at(a.lat, a.lon);
    if (inside(p) && !labels.some((l) => Math.abs(l.x - p.x) < LABEL_GAP.x && Math.abs(l.y - p.y) < LABEL_GAP.y)) labels.push({ name: a.name, ...p });
  }
  const sg = at(SG.lat, SG.lon);
  const edge = (x: number, width: number) => (x < width / 2 ? "start" : x > w - width / 2 ? "end" : "middle");

  return (
    <svg ref={svg} aria-hidden viewBox={`0 0 ${w || 1} ${h || 1}`} className="pointer-events-none absolute inset-0 size-full overflow-hidden">
      {w > 0 && (
        <>
          {layers.ahead && hasLayer(replay, "ahead") && (
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={ahead} stroke={DARK} strokeWidth={6} />
              <polyline points={ahead} stroke={FIRE_COLOR} strokeWidth={3} strokeDasharray="7 6" />
            </g>
          )}
          {layers.fires && (
            <g>
              {fires.map(([la, lo], i) => {
                const p = at(la, lo);
                return inside(p) && <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={FIRE_COLOR} stroke="rgb(0 0 0 / 0.55)" strokeWidth={0.8} />;
              })}
              {fresh.map(([la, lo], i) => {
                const p = at(la, lo);
                return (
                  inside(p) && (
                    <g key={i} fill="none">
                      <circle cx={p.x} cy={p.y} r={10} stroke="rgb(0 0 0 / 0.5)" strokeWidth={3.5} />
                      <circle cx={p.x} cy={p.y} r={10} stroke={NEW_FIRE_COLOR} strokeWidth={1.5} />
                    </g>
                  )
                );
              })}
            </g>
          )}
          {layers.labels && (
            <g fill="#fff" fontSize={12} fontWeight={600} textAnchor="middle">
              {labels.map((l) => (
                <text key={l.name} x={l.x} y={l.y - 9} textAnchor={edge(l.x, 90)} {...HALO}>
                  {l.name}
                </text>
              ))}
            </g>
          )}
          <circle cx={sg.x} cy={sg.y} r={4.5} fill="#fff" stroke="rgb(0 0 0 / 0.65)" strokeWidth={2} />
          <g fill="#fff" fontWeight={700} fontSize={13} {...HALO}>
            <text x={sg.x + 9} y={sg.y - 5}>
              Singapore
            </text>
            {pm25 != null && (
              <text x={sg.x + 9} y={sg.y + 10} fontSize={12} fontWeight={600}>
                PM2.5 {Math.round(pm25)} µg/m³
              </text>
            )}
          </g>
        </>
      )}
    </svg>
  );
}
