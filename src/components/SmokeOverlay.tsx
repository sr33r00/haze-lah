"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FIRE_COLOR, NEW_FIRE_COLOR, topAreas } from "@/lib/replay";
import { SAT_SIZE, onImage } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { SG } from "@/lib/util";
import { Segmented } from "./ui";

/** The layers of the picture that can be switched off, as the chips list them. */
export const SMOKE_LAYERS = [
  { id: "fires", label: "Fires" },
  { id: "ahead", label: "Smoke heading" },
  { id: "labels", label: "Labels" },
] as const;
export type SmokeLayer = (typeof SMOKE_LAYERS)[number]["id"];

const LABELLED_AREAS = 3; // provinces named: the ones with most fires that day
const LABEL_GAP = { x: 80, y: 16 }; // px; a province label this close to an earlier one is left out
const LABEL_W = 7.6; // px a character of a 13 px semi-bold province label takes, for its box
const LABEL_H = 17; // px; a province label's height, halo included
const SG_TEXT_W = 8.3; // px a character of Singapore's 15 px reading takes, for its box
const HALO = { stroke: "rgb(0 0 0 / 0.75)", strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke" } as const; // so text reads on cloud and on dark land
const DARK = "rgb(0 0 0 / 0.45)";

/** Whether the replay has anything for the layer; a chip for a layer with nothing is not shown. */
export function hasLayer(replay: Replay | null, layer: SmokeLayer) {
  const day = replay?.days.at(-1);
  return layer === "ahead" ? (day?.ahead?.path.length ?? 0) > 1 : (day?.fires.length ?? 0) > 0;
}

/** The chips that switch the `shown` layers of a picture on and off, `layers` saying which are on. */
export function LayerChips({ shown, layers, onToggle }: { shown: readonly { id: SmokeLayer; label: string }[]; layers: Partial<Record<SmokeLayer, boolean>>; onToggle: (id: SmokeLayer) => void }) {
  return <Segmented label="Show on the picture" options={shown} on={(id) => !!layers[id]} onSelect={onToggle} className="mb-3" />;
}

/** One line of a picture's key: a `mark` and what it means. */
export function Key({ mark, children }: { mark: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-[3px] flex h-3.5 w-5 shrink-0 items-center justify-center">
        {mark}
      </span>
      <span>{children}</span>
    </li>
  );
}

type Box = { left: number; top: number; right: number; bottom: number };
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Fires (`fires`: [lat, lon, ...]), the names of the provinces with most of them, the paths of the smoke (`ahead`) and the new fire
 * zones (`fresh`), drawn over the satellite picture of `SAT_BOX`, with Singapore and, under its name, `reading` (a short text such as its PM2.5).
 * A province label never lands on Singapore's dot or text: it moves clear of it, or is left out. An SVG in the picture's own pixels
 * (measured, so dots and text keep their size at any width); whatever lies outside the picture is cut off. Meant to sit inside the picture's box: it ignores the pointer.
 */
export default function SmokeOverlay({
  fires,
  ahead,
  layers,
  reading,
  fresh = [],
}: {
  fires: readonly (readonly number[])[];
  ahead?: readonly (readonly number[])[];
  layers: Partial<Record<SmokeLayer, boolean>>;
  reading: string | null;
  fresh?: [number, number][];
}) {
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
  const h = (w * SAT_SIZE.h) / SAT_SIZE.w;
  const at = (lat: number, lon: number) => {
    const p = onImage(lat, lon);
    return { x: (p.x * w) / 100, y: (p.y * h) / 100 };
  };
  const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;

  const areas = useMemo(() => topAreas(fires, LABELLED_AREAS), [fires]);
  const path = (ahead ?? []).map(([la, lo]) => Object.values(at(la, lo)).join(",")).join(" ");

  const sg = at(SG.lat, SG.lon);
  const edge = (x: number, width: number) => (x < width / 2 ? "start" : x > w - width / 2 ? "end" : "middle");
  // Singapore's dot, name and reading as one box, to keep province labels off.
  const sgBox: Box = { left: sg.x - 7, top: sg.y - 21, right: sg.x + 9 + Math.max(80, (reading?.length ?? 0) * SG_TEXT_W), bottom: reading ? sg.y + 20 : sg.y + 7 };
  /** The box a province label takes: its text sits on the baseline `l.y - 9`, anchored as `edge` says. */
  const boxOf = (l: { name: string; x: number; y: number }): Box => {
    const width = l.name.length * LABEL_W;
    const anchor = edge(l.x, 90);
    const left = anchor === "start" ? l.x : anchor === "end" ? l.x - width : l.x - width / 2;
    const top = l.y - 9 - 12;
    return { left, right: left + width, top, bottom: top + LABEL_H };
  };

  const labels: { name: string; x: number; y: number }[] = [];
  for (const a of areas) {
    const p = at(a.lat, a.lon);
    if (!inside(p) || labels.some((l) => Math.abs(l.x - p.x) < LABEL_GAP.x && Math.abs(l.y - p.y) < LABEL_GAP.y)) continue;
    let l = { name: a.name, ...p };
    const b = boxOf(l);
    if (overlap(b, sgBox)) {
      // Moved clear of Singapore, just above or just below it, whichever is nearer; left out when that takes it off the picture.
      const up = sgBox.top - b.bottom - 2;
      const down = sgBox.bottom - b.top + 2;
      l = { ...l, y: l.y + (-up <= down ? up : down) };
      const moved = boxOf(l);
      if (moved.top < 0 || moved.bottom > h) continue;
    }
    labels.push(l);
  }

  return (
    <svg ref={svg} aria-hidden viewBox={`0 0 ${w || 1} ${h || 1}`} className="pointer-events-none absolute inset-0 size-full overflow-hidden">
      {w > 0 && (
        <>
          {layers.ahead && path && (
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={path} stroke={DARK} strokeWidth={6} />
              <polyline points={path} stroke={FIRE_COLOR} strokeWidth={3} strokeDasharray="7 6" style={{ filter: "drop-shadow(0 0 1px #fff)" }} />
            </g>
          )}
          {layers.fires && (
            <g>
              {fires.map(([la, lo], i) => {
                const p = at(la, lo);
                return inside(p) && <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={FIRE_COLOR} stroke="#fff" strokeWidth={0.8} />;
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
            <g fill="#fff" fontSize={13} fontWeight={600} textAnchor="middle">
              {labels.map((l) => (
                <text key={l.name} x={l.x} y={l.y - 9} textAnchor={edge(l.x, 90)} {...HALO}>
                  {l.name}
                </text>
              ))}
            </g>
          )}
          <circle cx={sg.x} cy={sg.y} r={4.5} fill="#fff" stroke="rgb(0 0 0 / 0.65)" strokeWidth={2} />
          <g fill="#fff" fontWeight={700} fontSize={15} {...HALO}>
            <text x={sg.x + 9} y={sg.y - 6}>
              Singapore
            </text>
            {reading && (
              <text x={sg.x + 9} y={sg.y + 12} fontSize={15} fontWeight={600}>
                {reading}
              </text>
            )}
          </g>
        </>
      )}
    </svg>
  );
}
