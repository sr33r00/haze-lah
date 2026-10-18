"use client";

import { useState } from "react";
import { fmtTime } from "@/lib/format";
import { sgDate } from "@/lib/util";
import { SG_ON_IMAGE, type SatImage } from "@/lib/satellite";

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", timeZone: "Asia/Singapore" }).format(new Date(`${date}T12:00:00+08:00`));

const CHIP = "min-h-[40px] shrink-0 rounded-full border px-3 text-[13px] font-semibold";

/** Satellite views of the region: daily true colour with fires, or the latest 10-minute Himawari image. */
export default function SatelliteView({ daily, live }: { daily: SatImage[]; live: SatImage }) {
  const [pick, setPick] = useState<number | "live">(0);
  const img = pick === "live" ? live : daily[pick];
  const caption =
    pick === "live"
      ? `Himawari-9, ${dayLabel(sgDate(0, new Date(live.time)))} ${fmtTime(live.time)}. Black and white, updated every 10 minutes from 9am to 5pm. Haze shows as a grey veil.`
      : "NOAA-20 true colour, about 1:30pm. Grey-brown veil is smoke; red dots are fires.";
  return (
    <div>
      <div role="group" aria-label="Choose image" className="flex gap-1.5 overflow-x-auto px-4 pb-2">
        <button onClick={() => setPick("live")} aria-pressed={pick === "live"} className={`${CHIP} ${pick === "live" ? "border-fg bg-fg text-bg" : "border-line bg-surface"}`}>
          Latest
        </button>
        {daily.map((d, i) => (
          <button key={d.time} onClick={() => setPick(i)} aria-pressed={pick === i} className={`${CHIP} ${pick === i ? "border-fg bg-fg text-bg" : "border-line bg-surface"}`}>
            {dayLabel(d.time)}
          </button>
        ))}
      </div>
      <div className="px-4">
        <a href={img.link} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-2xl bg-line" aria-label="Open in NASA Worldview">
          {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves sized images; no optimisation needed */}
          <img key={img.url} src={img.url} alt={`Satellite image of Sumatra, Singapore and Borneo, ${img.time}`} width={1000} height={520} className="h-auto w-full" />
          <span
            aria-hidden
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${SG_ON_IMAGE.x}%`, top: `${SG_ON_IMAGE.y}%` }}
          />
          <span
            aria-hidden
            className="absolute -translate-y-1/2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white"
            style={{ left: `calc(${SG_ON_IMAGE.x}% + 12px)`, top: `${SG_ON_IMAGE.y}%` }}
          >
            Singapore
          </span>
        </a>
        <p className="mt-2 text-[13px] text-muted">{caption}</p>
        <p className="mt-1 text-[12px] text-muted">
          Imagery from NASA GIBS and Worldview; Himawari-9 data from the Japan Meteorological Agency. Tap the image to explore.
        </p>
      </div>
    </div>
  );
}
