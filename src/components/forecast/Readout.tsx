"use client";

import { useEffect, useState } from "react";
import { windFrom } from "@/lib/context";
import { cap, fmtHour } from "@/lib/format";
import { dayWord, type InstrumentHour } from "@/lib/forecastHours";
import { FIRE_COLOR } from "@/lib/replay";

/** Fire orange, mixed with the text colour so it reads on both the light and the dark card. */
const FIRE_TEXT = `color-mix(in srgb, ${FIRE_COLOR} 70%, var(--fg))`;
const ANNOUNCE_MS = 500; // a screen reader hears the hour only once the scrub has paused this long

/** The three lines of the readout for one hour; a line with nothing to say is "". `fires` ends line 2. */
export function readoutLines(h: InstrumentHour, now = new Date()) {
  const when = `${cap(dayWord(h.t, now))} ${fmtHour(h.t)}`;
  const rain = h.rainProb != null ? `Rain ${Math.round(h.rainProb)}%` : "";
  if (h.pm25 == null) return { line1: h.observed != null ? `${when}  Measured ${Math.round(h.observed)} µg/m³` : when, line2: "", fires: "", line3: rain };
  const range = h.low != null && h.high != null ? ` (${Math.round(h.low)}–${Math.round(h.high)})` : "";
  const chance = h.pHigh != null ? `  ${Math.round(h.pHigh * 100)}% above 55` : "";
  const w = h.wind;
  const line2 = [h.raw != null && `Copernicus says ${Math.round(h.raw)}`, w && `from the ${windFrom(w.deg)} at ${w.kmh} km/h`].filter(Boolean).join(", ");
  const fires = w && w.near > 0 ? `over ${w.near.toLocaleString("en-SG")} ${w.near === 1 ? "fire" : "fires"}${w.area ? ` in ${w.area}` : ""}` : "";
  return { line1: `${when}  PM2.5 ${Math.round(h.pm25)}${range}${chance}`, line2, fires, line3: rain };
}

/** The readout as one sentence per line, for a screen reader. */
export function readoutText(h: InstrumentHour, now?: Date) {
  const { line1, line2, fires, line3 } = readoutLines(h, now);
  return [line1.replace(/ {2,}/g, ", "), [line2, fires].filter(Boolean).join(", "), line3].filter(Boolean).join(". ");
}

/**
 * What is measured or forecast at one hour: time, PM2.5 with its likely range and the chance of passing 55, the model's value,
 * the wind and the fires it crosses, and the rain chance. It reserves all its lines, so nothing around it moves while the hour changes.
 * The screen-reader copy is a polite live region that updates only after the hour has stayed put for a moment.
 */
export default function Readout({ hour, className = "" }: { hour: InstrumentHour; className?: string }) {
  const { line1, line2, fires, line3 } = readoutLines(hour);
  const text = readoutText(hour);
  const [announced, setAnnounced] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setAnnounced(text), ANNOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <div className={className}>
      <div aria-hidden className="tabular text-[15px] leading-5">
        <p className="line-clamp-2 h-10 whitespace-pre-wrap font-bold">{line1}</p>
        <p className="line-clamp-2 h-10 text-muted">
          {line2}
          {fires && (
            <>
              {line2 && ", "}
              <span className="font-semibold" style={{ color: FIRE_TEXT }}>
                {fires}
              </span>
            </>
          )}
        </p>
        <p className="h-5 text-muted">{line3}</p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
