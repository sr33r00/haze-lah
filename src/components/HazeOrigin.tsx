"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtWeekday } from "@/lib/format";
import { FIRE_COLOR, NEW_FIRE_COLOR, TRAIL_COLOR, fetchReplay, newFires, trailCaption, windAtSg } from "@/lib/replay";
import { RELIEF, SAT_BOX, onImage } from "@/lib/satellite";
import type { Replay } from "@/lib/types";
import { sgDate } from "@/lib/util";
import { windOf, type WindView } from "@/lib/windParticles";
import AirJourney from "./AirJourney";
import SgPin from "./SgPin";
import SmokeAhead from "./SmokeAhead";
import { Section } from "./ui";
import { useWindParticles } from "./useWindParticles";
import WindMotionButton, { useWindMotion } from "./WindMotion";

const W = 1000;
const H = 520; // same shape as the satellite box
const at = ([lat, lon]: [number, number]) => {
  const p = onImage(lat, lon);
  return [(p.x / 100) * W, (p.y / 100) * H] as const;
};

const MARK_H = 24; // the trail is marked at every 24 h back

/** The relief image as the wind animation sees it: a flat picture of `SAT_BOX` that never moves, so only a resize needs telling. */
function imageView(container: HTMLElement): WindView {
  const [south, west, north, east] = SAT_BOX;
  const size = () => ({ w: container.clientWidth, h: container.clientHeight });
  return {
    container,
    zIndex: 0,
    size,
    project: (lat, lon) => {
      const p = onImage(lat, lon);
      const { w, h } = size();
      return { x: (p.x / 100) * w, y: (p.y / 100) * h };
    },
    bounds: () => [south, west, north, east],
    pxPerDeg: () => size().w / (east - west),
    listen: ({ resized }) => {
      const ro = new ResizeObserver(resized);
      ro.observe(container);
      return () => ro.disconnect();
    },
  };
}

/** "Where today's air came from": the back-trajectory of the air reaching Singapore this afternoon, over a relief map. */
export default function HazeOrigin({ className }: { className?: string }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [failed, setFailed] = useState(false);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null); // where the wind lines are drawn
  const { reduced, motion, toggle } = useWindMotion();

  useEffect(() => {
    fetchReplay()
      .then((r) => (r.days.length ? setReplay(r) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const day = replay?.days.at(-1) ?? null;
  const view = useMemo(() => (layer ? imageView(layer) : undefined), [layer]);
  const wind = useMemo(() => (replay && day ? windOf(replay.lats, replay.lons, day.wind.u, day.wind.v) : undefined), [replay, day]);
  useWindParticles(view, wind, motion, "#fff");

  if (failed) return null;
  // Origin first, so the flowing dashes move towards Singapore.
  const path = day?.trail.length ? [...day.trail].reverse().map((p) => at(p).join(",")).join(" ") : "";

  const ahead = day?.ahead && day.ahead.path.length > 1 ? day.ahead.path.map((p) => at(p).join(",")).join(" ") : "";
  const fresh = replay ? newFires(replay.days) : [];
  const here = replay && day ? windAtSg(replay, day.wind) : null;
  // A dot and the weekday at every 24 h back along the trail.
  const marks = [];
  for (let h = MARK_H; day && h < day.trail.length; h += MARK_H) {
    marks.push({ ...onImage(...day.trail[h]), label: fmtWeekday(sgDate(0, new Date(Date.parse(day.arrival) - h * 3600_000))) });
  }

  return (
    <Section id="origin" className={className} title="Where today's air came from">
      <figure className="px-4">
        <div className={`relative aspect-[1000/520] overflow-hidden rounded-2xl bg-line ${day ? "" : "animate-pulse"}`}>
          {day && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves a sized image; no optimisation needed */}
              <img src={RELIEF} alt="Relief map of Sumatra, Singapore and Borneo" width={W} height={H} className="absolute inset-0 h-full w-full" />
              {/* The wind lines go under the svg, so the path and fires stay clear of them */}
              <div ref={setLayer} aria-hidden className="absolute inset-0" />
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
                {fresh.map((p, i) => {
                  const [x, y] = at(p);
                  return (
                    <g key={i} fill="none">
                      <circle cx={x} cy={y} r={13} stroke="#000" strokeOpacity={0.4} strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
                      <circle cx={x} cy={y} r={13} stroke={NEW_FIRE_COLOR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </svg>
              {marks.map((m) => (
                <span key={m.label} aria-hidden className="absolute" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
                  <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white" style={{ borderColor: TRAIL_COLOR }} />
                  <span
                    className={`absolute top-0 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold text-white [text-shadow:0_0_3px_#000,0_1px_2px_#000] ${m.x > 85 ? "right-2" : "left-2"}`}
                  >
                    {m.label}
                  </span>
                </span>
              ))}
              <SgPin />
              {here && <span className="sg-label bottom-2 left-2">{`Wind from the ${here.from}, ${here.kmh} km/h`}</span>}
            </>
          )}
        </div>
        <figcaption className="mt-3 min-h-[18rem] text-[13px] text-muted">
          {day && (
            <>
              {(fresh.length > 0 || ahead) && (
                <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {fresh.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-3 rounded-full border-[1.5px]" style={{ borderColor: NEW_FIRE_COLOR }} />
                      {fresh.length.toLocaleString("en-SG")} new fire {fresh.length === 1 ? "zone" : "zones"} today
                    </span>
                  )}
                  {ahead && (
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="w-4 border-t-[3px] border-dashed" style={{ borderColor: FIRE_COLOR }} />
                      Where smoke goes next
                    </span>
                  )}
                </p>
              )}
              {reduced && <WindMotionButton motion={motion} onToggle={toggle} className="mb-3" />}
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
