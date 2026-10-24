"use client";

import { useEffect, useState } from "react";
import { readoutLines, readoutText, type InstrumentHour } from "@/lib/forecastHours";
import { FIRE_COLOR } from "@/lib/replay";

/** Fire orange, mixed with the text colour so it reads on both the light and the dark card. */
const FIRE_TEXT = `color-mix(in srgb, ${FIRE_COLOR} 70%, var(--fg))`;
const ANNOUNCE_MS = 500; // a screen reader hears the hour only once the scrub has paused this long

/**
 * What is measured or forecast at one hour: time, PM2.5 with its likely range and the chance of passing 55, the model's value,
 * the wind, the fires it crosses and the rain chance. It reserves all its lines, so nothing around it moves while the hour changes.
 * The screen-reader copy is a polite live region that updates only after the hour has stayed put for a moment.
 */
export default function Readout({ hour, className = "" }: { hour: InstrumentHour; className?: string }) {
  const { when, figures, line2, fires, rain } = readoutLines(hour);
  const text = readoutText(hour);
  const [announced, setAnnounced] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setAnnounced(text), ANNOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <div className={className}>
      <div aria-hidden className="tabular text-[15px] leading-5">
        <p className="line-clamp-2 h-10 font-bold">
          {[when, ...figures].map((part, i) => (
            <span key={i} className="mr-2 inline-block whitespace-nowrap">
              {part}{" "}
            </span>
          ))}
        </p>
        <p className="line-clamp-1 h-5 text-muted">{line2}</p>
        <p className="line-clamp-2 h-10 text-muted">
          {fires && (
            <span className="font-semibold" style={{ color: FIRE_TEXT }}>
              {fires}
            </span>
          )}
          {fires && rain && " · "}
          {rain}
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
