"use client";

import { ChevronUp } from "lucide-react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { GLOBE_LAYERS, satelliteRampCss } from "@/lib/globe";
import { NEA_PSI_URL, OPEN_DATA_LICENCE, WIND_NOTE } from "@/lib/links";
import { bandNames, pollutant, rampCss } from "@/lib/pollutants";
import type { Dot } from "@/lib/readings";
import { AHEAD_LABEL } from "@/lib/replay";
import type { GlobeDay, LayerChoice } from "./frame";
import RampBar from "../RampBar";
import { INK } from "./globeStyle";

type Props = {
  /** One data-built sentence on the day. */
  headline: string;
  /** A few short facts on the day, shown when the card is open (always on a laptop). */
  facts: string[];
  layer: LayerChoice;
  day: GlobeDay;
  dots: Dot[];
  /** Whether a change of headline is announced to a screen reader (off while the timeline plays). */
  live: boolean;
  /** Phone only: whether the card is open. */
  expanded: boolean;
  onToggle: (open?: boolean) => void;
  className?: string;
};

/** Pixels a drag on the grip must travel to open or close the card; less is a tap. */
const DRAG = 24;
/** Shown when the card is open on a phone, and always from the tablet width up. */
const EXTRAS = "min-[700px]:block";

const swatch = {
  fire: <span className="size-2.5 rounded-full" style={{ background: INK.fireCore, boxShadow: `0 0 6px 1px ${INK.fireGlow}` }} />,
  zone: <span className="size-3 rounded-full border-[1.5px]" style={{ borderColor: INK.newZone }} />,
  path: <span className="h-[3px] w-5 rounded-full" style={{ background: `linear-gradient(to right, ${INK.trail}, rgba(168,85,247,0.25))` }} />,
  ahead: <span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: INK.ahead }} />,
  measured: <span className="size-2.5 rounded-full border border-white/90 bg-[#b08a5a]" />,
  model: <span className="size-2.5 rounded-full border-[1.5px] border-[#b08a5a]" />,
};

/** What the globe is drawing now, for the key. */
function keyOf(day: GlobeDay, dots: Dot[]): [keyof typeof swatch, string][] {
  const items: [keyof typeof swatch, string, boolean][] = [
    ["fire", "Fire", day.fires.length > 0],
    ["zone", "New fire zone", day.fresh.length > 0],
    ["path", "Where the air came from", day.trail.length > 1],
    ["ahead", AHEAD_LABEL, day.ahead.length > 1],
    ["measured", "Measured reading", dots.some((d) => d.kind === "measured")],
    ["model", "Model value", dots.some((d) => d.kind === "model")],
  ];
  return items.filter(([, , shown]) => shown).map(([id, label]) => [id, label]);
}

/** The colour bar of the layer with its band names; the band limits are for the open card. */
function Legend({ layer, expanded }: { layer: LayerChoice; expanded: boolean }) {
  if (layer === "off") return null;
  const p = layer === "smoke" ? null : pollutant(layer);
  const { ramp } = GLOBE_LAYERS.smoke;
  const title = p ? `${p.label}, ${p.unit}, model` : `${ramp.unit}, NASA satellite`;
  const names = p?.tracer ? p.tracer.ends : p ? (p.bands ? bandNames(p) : ["Low", "High"]) : [...ramp.ends]; // four bands, or the two ends of a ramp
  const limits = p?.tracer ? null : (p?.bands ?? null);
  return (
    <div className="mt-2">
      <p className={`text-label leading-5 text-white/65 ${expanded ? "" : "hidden"} ${EXTRAS}`}>{title}</p>
      <RampBar background={p ? rampCss(p) : satelliteRampCss(ramp)} names={names} bar="border-white/20 bg-black/50" text="text-white/85" />
      {limits && (
        <div className={`relative h-4 text-fine leading-4 text-white/65 tabular ${expanded ? "block" : "hidden"} ${EXTRAS}`}>
          {limits.map((v, i) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: `${(i + 1) * 25}%` }}>
              {v.toLocaleString("en-SG")}
            </span>
          ))}
        </div>
      )}
      {p?.tracer && (
        <p className={`mt-1 text-label leading-5 text-white/65 ${expanded ? "block" : "hidden"} ${EXTRAS}`}>
          {p.tracer.note}{" "}
          <a href={NEA_PSI_URL} target="_blank" rel="noreferrer" className="link">
            NEA PSI method
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * The card at the bottom of the globe: a headline for the day, the colour legend, and (open on a phone, always on a laptop) the
 * day's facts, the key to the symbols and the credits. On a phone a grip opens it: tap it, or drag it up or down.
 */
export default function GlobeCard({ headline, facts, layer, day, dots, live, expanded, onToggle, className = "" }: Props) {
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  const items = keyOf(day, dots);
  const row = (children: ReactNode) => <div className="flex items-center gap-2 text-label leading-5 text-white/85">{children}</div>;

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    start.current = e.clientY;
    dragged.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {} // an untracked pointer cannot be captured
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const dy = start.current == null ? 0 : e.clientY - start.current;
    start.current = null;
    if (Math.abs(dy) < DRAG) return; // a tap: onClick toggles
    dragged.current = true;
    onToggle(dy < 0);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="globe-more"
        aria-label="Details"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        onClick={() => (dragged.current ? (dragged.current = false) : onToggle())}
        className="absolute inset-x-0 top-0 z-10 flex h-11 touch-none justify-center pt-1 min-[700px]:hidden"
      >
        <span aria-hidden className="grid place-items-center">
          <ChevronUp size={20} className={`text-white/70 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      <div className="px-4 pb-1 pt-7 min-[700px]:px-5 min-[700px]:pb-4 min-[700px]:pt-4">
        <h2 aria-live={live ? "polite" : "off"} className="line-clamp-2 text-balance text-label font-bold leading-5 min-[700px]:line-clamp-none min-[700px]:text-[17px] min-[700px]:leading-[22px]">
          {headline}
        </h2>
        <Legend layer={layer} expanded={expanded} />

        <div id="globe-more" className={`${expanded ? "block" : "hidden"} ${EXTRAS} mt-3 max-h-[42dvh] overflow-y-auto overscroll-contain min-[700px]:max-h-none min-[700px]:overflow-visible`}>
          {facts.length > 0 && <p className="text-label leading-5 text-white/90">{facts.join(" · ")}</p>}
          {items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-3">
              {items.map(([id, label]) => (
                <div key={id}>
                  {row(
                    <>
                      <span aria-hidden className="grid w-5 shrink-0 place-items-center">
                        {swatch[id]}
                      </span>
                      {label}
                    </>,
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-label leading-5 text-white/65">{WIND_NOTE}</p>
          <details className="mt-3 border-t border-white/10 text-white/60 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-label font-semibold text-white/80 underline-offset-2 hover:underline">Sources</summary>
          <p className="pb-1 pt-1 text-label leading-5 text-white/60">
            Fires: NASA FIRMS. Satellite pictures: NASA GIBS (OMPS). Pollution and wind: Copernicus Atmosphere Monitoring Service and ECMWF via Open-Meteo; contains modified Copernicus
            Atmosphere Monitoring Service information. Readings: NEA under the{" "}
            <a href={OPEN_DATA_LICENCE} target="_blank" rel="noreferrer" className="link">
              Singapore Open Data Licence
            </a>
            , Malaysia APIMS and OpenAQ. Map:{" "}
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="link">
              OpenFreeMap
            </a>
            , ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="link">
              OpenStreetMap contributors
            </a>
            .
          </p>
          </details>
        </div>
      </div>
    </div>
  );
}
