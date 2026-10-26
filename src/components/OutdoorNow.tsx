"use client";

import { CloudRain, Sun, Thermometer, Zap, type LucideIcon } from "lucide-react";
import { LEVEL_TEXT, type Region } from "@/lib/bands";
import { HEAT_STRESS_URL, OPEN_DATA_LICENCE } from "@/lib/links";
import { LIGHTNING_RADIUS_KM, UV_SOURCES, outdoorCells, type OutdoorCell } from "@/lib/outdoor";
import InfoNote from "./InfoNote";
import { useOutdoor } from "./useOutdoor";

const CELLS: { key: "rain" | "heat" | "uv" | "lightning"; label: string; icon: LucideIcon }[] = [
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "heat", label: "Heat", icon: Thermometer },
  { key: "uv", label: "UV", icon: Sun },
  { key: "lightning", label: "Lightning", icon: Zap },
];

/** One reading: its label, the value and a muted line with the place and time. `cell` is undefined while loading and null when the source has no answer. */
function Cell({ label, icon: Icon, cell }: { label: string; icon: LucideIcon; cell: OutdoorCell | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-label text-muted">
        <Icon aria-hidden size={16} className="shrink-0" style={cell?.warn ? { color: LEVEL_TEXT[3] } : undefined} />
        {label}
      </dt>
      <dd className="mt-0.5 min-h-[44px]">
        {cell === undefined ? (
          <span aria-hidden className="mt-1 block h-5 w-3/4 animate-pulse rounded bg-line" />
        ) : cell === null ? (
          <span className="text-[17px] font-semibold text-muted">Unavailable</span>
        ) : (
          <>
            <span className="tabular block text-[19px] font-bold leading-snug" style={cell.warn ? { color: LEVEL_TEXT[3] } : undefined}>
              {cell.value}
            </span>
            <span className="block text-label leading-snug text-muted">{cell.sub}</span>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Rain, heat, UV and lightning for the chosen region, straight from NEA's real-time feeds (`/api/outdoor`, read again every 5 minutes).
 * Each reading stands alone: one that failed or went stale says "Unavailable" and never a guess. `now` (see `useNow`) is the time to judge freshness by.
 */
export default function OutdoorNow({ region, now }: { region: Region; now: number }) {
  const feeds = useOutdoor();
  const cells = feeds ? outdoorCells(feeds, region, now) : feeds === null ? { rain: null, heat: null, uv: null, lightning: null } : null;
  return (
    <div className="mx-4 rounded-3xl bg-surface p-4">
      <dl aria-live="polite" className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2">
        {CELLS.map((c) => (
          <Cell key={c.key} label={c.label} icon={c.icon} cell={cells ? cells[c.key] : undefined} />
        ))}
      </dl>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <p className="text-label text-muted">
          Contains information from NEA via data.gov.sg, made available under the{" "}
          <a href={OPEN_DATA_LICENCE} target="_blank" rel="noreferrer" className="underline">
            Singapore Open Data Licence
          </a>
          .
        </p>
        <InfoNote lead={<span>About these readings</span>}>
          <p>Rain is NEA&apos;s 2-hour forecast for the town nearest the middle of the chosen region.</p>
          <p>
            Heat is the WBGT (wet-bulb globe temperature, in °C) that NEA measures at the nearest of its stations, with NEA&apos;s own heat stress band. WBGT adds humidity, wind and sun to the air temperature.{" "}
            <a href={HEAT_STRESS_URL} target="_blank" rel="noreferrer" className="underline">
              NEA, Heat stress
            </a>
          </p>
          <p>
            UV is the last hour NEA measured, with the WHO categories: 0 to 2 Low, 3 to 5 Moderate, 6 to 7 High, 8 to 10 Very high, 11 and over Extreme.{" "}
            {UV_SOURCES.map(([name, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="underline">
                {name}
              </a>
            ))}
          </p>
          <p>Lightning counts the strikes NEA detected within {LIGHTNING_RADIUS_KM} km of the middle of the region in the last 30 minutes.</p>
        </InfoNote>
      </div>
    </div>
  );
}
