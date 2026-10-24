"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchReplay, newFires } from "@/lib/replay";
import type { DayPsi, Replay } from "@/lib/types";
import HimawariLoop, { LiveKey } from "./HimawariLoop";
import SmokeThickness, { WeekKey } from "./SmokeThickness";
import { LayerChips, SMOKE_LAYERS, hasLayer, type SmokeLayer } from "./SmokeOverlay";
import { Section, Segmented } from "./ui";
import { useNearScreen } from "./useNearScreen";

const MODES = [
  { id: "live", label: "Live" },
  { id: "week", label: "Last 7 days" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const ASIDE: Record<Mode, string> = { live: "Himawari-9, every 10 min", week: "NASA VIIRS, daily" };

/**
 * "Smoke from space": the Himawari-9 loop ("Live", `HimawariLoop`) or the day slider of smoke thickness ("Last 7 days", `SmokeThickness`) over
 * Sumatra, Singapore and Borneo, with one set of chrome for both: the toggle, the layer chips (kept when the view changes), the key of the view
 * shown, and its credits. The replay of today's fires and paths is fetched here once, and nothing loads until the section is near the screen.
 * `pm25` is Singapore's highest 1-hour PM2.5 (NEA) and `psiDaily` its days of 24-hr PSI.
 */
export default function FromSpace({ pm25, psiDaily }: { pm25: number | null; psiDaily: DayPsi[] }) {
  const box = useRef<HTMLDivElement>(null);
  const near = useNearScreen(box);
  const [mode, setMode] = useState<Mode>("live");
  const [layers, setLayers] = useState<Record<SmokeLayer, boolean>>({ fires: true, ahead: true, labels: true });
  const [replay, setReplay] = useState<Replay | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (near) fetchReplay().then(setReplay, () => setFailed(true));
  }, [near]);

  const fresh = useMemo(() => (replay ? newFires(replay.days) : []), [replay]);
  const shown = SMOKE_LAYERS.filter((l) => hasLayer(replay, l.id) && (mode === "live" || l.id !== "ahead")); // a past day has no smoke path
  const live = mode === "live";

  return (
    <Section id="space" title="Smoke from space" aside={ASIDE[mode]}>
      <div ref={box} className="px-4">
        <Segmented label="Satellite view" options={MODES} on={(id) => id === mode} onSelect={setMode} className="mb-3 lg:max-w-sm" />
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
          <div>
            {live ? (
              <HimawariLoop pm25={pm25} replay={replay} failed={failed} fresh={fresh} layers={layers} near={near} />
            ) : (
              <SmokeThickness psiDaily={psiDaily} replay={replay} layers={layers} near={near} />
            )}
          </div>
          <div className="mt-3 lg:mt-0">
            {shown.length > 0 && <LayerChips shown={shown} layers={layers} onToggle={(id) => setLayers((old) => ({ ...old, [id]: !old[id] }))} />}
            <h3 className="text-[13px] font-semibold text-fg">How to read this</h3>
            {live ? <LiveKey replay={replay} fresh={fresh} layers={layers} /> : <WeekKey replay={replay} layers={layers} />}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {live
            ? `Himawari-9 (JMA) via NASA GIBS · Fires: NASA FIRMS · Wind: ECMWF via Open-Meteo${pm25 != null ? " · PM2.5: NEA" : ""}`
            : "Smoke: NASA VIIRS Deep Blue (NOAA-20, NOAA-21, Suomi NPP) via NASA GIBS · Fires: NASA FIRMS · PSI: NEA"}
        </p>
      </div>
    </Section>
  );
}
