"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIRE_COLOR, TRAIL_COLOR, trailCaption } from "@/lib/replay";
import { baseImage, onImage } from "@/lib/satellite";
import type { Replay, ReplayDay } from "@/lib/types";
import SgPin from "./SgPin";
import { Section } from "./ui";

const W = 1000;
const H = 520; // same shape as the satellite box
const at = ([lat, lon]: [number, number]) => {
  const p = onImage(lat, lon);
  return [(p.x / 100) * W, (p.y / 100) * H] as const;
};

/** "Where today's air came from": the back-trajectory of the air reaching Singapore this afternoon, over a relief map. */
export default function HazeOrigin({ className }: { className?: string }) {
  const [day, setDay] = useState<ReplayDay | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/replay")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: Replay) => (r.days.length ? setDay(r.days.at(-1)!) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  // Origin first, so the flowing dashes move towards Singapore.
  const path = day?.trail.length ? [...day.trail].reverse().map((p) => at(p).join(",")).join(" ") : "";

  return (
    <Section className={className} title="Where today's air came from">
      <figure className="px-4">
        <div className={`relative aspect-[1000/520] overflow-hidden rounded-2xl bg-line ${day ? "" : "animate-pulse"}`}>
          {day && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves a sized image; no optimisation needed */}
              <img src={baseImage()} alt="Relief map of Sumatra, Singapore and Borneo" width={W} height={H} className="absolute inset-0 h-full w-full" />
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
                {day.fires.map((p, i) => {
                  const [x, y] = at(p);
                  return <circle key={i} cx={x} cy={y} r={6} fill={FIRE_COLOR} fillOpacity={0.85} />;
                })}
                {day.trail.length > 1 && (
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={path} stroke={TRAIL_COLOR} strokeOpacity={0.3} strokeWidth={14} vectorEffect="non-scaling-stroke" />
                    <polyline points={path} stroke={TRAIL_COLOR} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                    <polyline
                      points={path}
                      stroke="#fff"
                      strokeOpacity={0.8}
                      strokeWidth={1.5}
                      strokeDasharray="2 10"
                      vectorEffect="non-scaling-stroke"
                      className="animate-flow motion-reduce:hidden"
                    />
                  </g>
                )}
              </svg>
              <SgPin />
            </>
          )}
        </div>
        <figcaption className="mt-3 min-h-[4.5rem] text-[13px] text-muted">
          {day && (
            <>
              <p className="text-[15px] font-bold text-fg">{trailCaption(day)}</p>
              <p className="mt-1">Traced back 3 days along the wind about 1.5 km up. Fires near the path are a likely, not certain, source.</p>
              <Link href="/map" className="mt-1 inline-block py-1 text-[14px] font-semibold text-accent">
                See it on the map
              </Link>
            </>
          )}
        </figcaption>
      </figure>
    </Section>
  );
}
