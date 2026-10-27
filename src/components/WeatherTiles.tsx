"use client";

import { CloudRain, Sun, Thermometer, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { LEVEL_TEXT, type Region } from "@/lib/bands";
import { OPEN_DATA_LICENCE } from "@/lib/links";
import { feelsLikeNow, outdoorCells, type OutdoorCell } from "@/lib/outdoor";
import type { WeatherHour } from "@/lib/types";
import { useOutdoor } from "./useOutdoor";

type Key = keyof ReturnType<typeof outdoorCells>;

const TILES: { key: Key; label: string; icon: LucideIcon }[] = [
  { key: "temp", label: "Temp", icon: Thermometer },
  { key: "uv", label: "UV", icon: Sun },
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "lightning", label: "Strikes", icon: Zap },
];

const WARN = LEVEL_TEXT[3];
/** Every tile has this height, loading or not, so nothing moves when the readings arrive. */
const TILE = "h-[84px] w-full rounded-lg";
/** The columns sit side by side with a thin divider between them, no boxes. */
const CELL = "min-w-0 border-l border-line px-0.5 first:border-l-0";

/** One tile: icon and label, the value and a muted line. `cell` is null when the source has no answer. */
function Tile({ label, icon: Icon, cell, open, onToggle }: { label: string; icon: LucideIcon; cell: OutdoorCell; open: boolean; onToggle: () => void }) {
  return (
    <div className={CELL}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="outdoor-detail"
        className={`${TILE} flex flex-col items-start px-1.5 py-1 text-left ${open ? "bg-line" : ""}`}
        style={cell?.warn === "tile" ? { background: `color-mix(in srgb, ${WARN} 10%, transparent)` } : undefined}
      >
        <span className="flex w-full items-center gap-1 text-fine text-muted">
          <Icon aria-hidden size={14} className="shrink-0" style={cell?.warn === "tile" || cell?.warn === "value" ? { color: WARN } : undefined} />
          {label}
        </span>
        <span
          className={`flex min-h-[38px] w-full items-center ${cell?.big ? "tabular text-[19px] font-bold leading-none" : "text-balance text-label font-semibold leading-tight"} ${cell ? "" : "text-muted"}`}
          style={cell?.warn === "value" || cell?.warn === "tile" ? { color: WARN } : undefined}
        >
          {cell ? cell.value : "–"}
        </span>
        <span className="w-full truncate text-fine text-muted" style={cell?.warn === "sub" ? { color: WARN } : undefined}>
          {cell ? cell.sub : "Unavailable"}
        </span>
      </button>
    </div>
  );
}

/**
 * Temperature, UV, rain and lightning for the chosen region in the hero: NEA's real-time feeds (`/api/outdoor`, read again every 5 minutes)
 * and the forecast's feels-like for this hour. Each reading stands alone: one that failed or went stale says "Unavailable", never a guess.
 * Tapping a tile shows its full facts below the row, one at a time. `now` (see `useNow`) is the time to judge freshness by.
 */
export default function WeatherTiles({ region, now, weather }: { region: Region; now: number; weather: WeatherHour[] }) {
  const feeds = useOutdoor();
  const [open, setOpen] = useState<Key | null>(null);
  const cells = feeds === undefined ? undefined : outdoorCells(feeds, region, now, feelsLikeNow(weather, now));
  const shown = open && cells ? cells[open] : null;
  return (
    <div id="outdoor" className="mt-4 scroll-mt-20 rounded-2xl bg-surface p-3 text-fg">
      <div aria-live="polite" className="grid grid-cols-4">
        {TILES.map((t) =>
          cells ? (
            <Tile key={t.key} label={t.label} icon={t.icon} cell={cells[t.key]} open={open === t.key} onToggle={() => setOpen(open === t.key ? null : t.key)} />
          ) : (
            <div key={t.key} aria-hidden className={CELL}>
              <span className={`block ${TILE} animate-pulse bg-line`} />
            </div>
          ),
        )}
      </div>
      <p id="outdoor-detail" aria-live="polite" hidden={!open} className="mt-2 text-label leading-snug">
        {open && (shown ? shown.detail : "NEA has no current reading.")}
        {shown?.links?.map(([name, url]) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-1 underline">
            {name}
          </a>
        ))}
      </p>
      <p className="mt-1.5 text-fine text-muted">
        Contains information from NEA via data.gov.sg, made available under the{" "}
        <a href={OPEN_DATA_LICENCE} target="_blank" rel="noreferrer" className="underline">
          Singapore Open Data Licence
        </a>
        .
      </p>
    </div>
  );
}
