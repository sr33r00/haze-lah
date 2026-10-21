"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIRE_COLOR, TRAIL_COLOR, fetchReplay, trailCaption } from "@/lib/replay";
import { RELIEF, onImage } from "@/lib/satellite";
import type { ReplayDay } from "@/lib/types";
import AirJourney from "./AirJourney";
import SgPin from "./SgPin";
import SmokeAhead from "./SmokeAhead";
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
    fetchReplay()
      .then((r) => (r.days.length ? setDay(r.days.at(-1)!) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  // Origin first, so the flowing dashes move towards Singapore.
  const path = day?.trail.length ? [...day.trail].reverse().map((p) => at(p).join(",")).join(" ") : "";

  const ahead = day?.ahead?.path.length ? day.ahead.path.map((p) => at(p).join(",")).join(" ") : "";

  return (
    <Section id="origin" className={className} title="Where today's air came from">
      <figure className="px-4">
        <div className={`relative aspect-[1000/520] overflow-hidden rounded-2xl bg-line ${day ? "" : "animate-pulse"}`}>
          {day && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves a sized image; no optimisation needed */}
              <img src={RELIEF} alt="Relief map of Sumatra, Singapore and Borneo" width={W} height={H} className="absolute inset-0 h-full w-full" />
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
                {day.fires.map((p, i) => {
                  const [x, y] = at(p);
                  return <circle key={i} cx={x} cy={y} r={6} fill={FIRE_COLOR} fillOpacity={0.85} />;
                })}
                {ahead && (
                  // Where smoke from today's fires goes next, under the trail: from the fire towards Singapore.
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={ahead} stroke="#fff" strokeOpacity={0.55} strokeWidth={6} vectorEffect="non-scaling-stroke" />
                    <polyline points={ahead} stroke={FIRE_COLOR} strokeWidth={3} strokeDasharray="7 7" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
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
        <figcaption className="mt-3 min-h-[18rem] text-[13px] text-muted">
          {day && (
            <>
              {day.journey ? <AirJourney day={day} /> : <p className="text-[15px] font-bold text-fg">{trailCaption(day)}</p>}
              <p className="mt-3">Traced back 3 days along the wind about 1.5 km up. Fires near the path are a likely, not certain, source.</p>
              <Link href="/map" className="mt-1 inline-block py-1 text-[14px] font-semibold text-accent">
                See it on the map
              </Link>
              {day.ahead && <SmokeAhead ahead={day.ahead} />}
            </>
          )}
        </figcaption>
      </figure>
    </Section>
  );
}
