"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { tips } from "@/lib/advice";
import { trend3h } from "@/lib/format";
import { fromHour } from "@/lib/forecast";
import { adviceStep, psiLevel } from "@/lib/bands";
import { currentReading, islandMax } from "@/lib/situation";
import type { AqiStation, DayOutlook, ForecastPoint, NeaNow, NeaPm25History, Sensor, Station, WeatherHour } from "@/lib/types";
import AirDetail from "./AirDetail";
import Advice from "./Advice";
import CigaretteCard from "./CigaretteCard";
import HazeOrigin from "./HazeOrigin";
import HazeOutlook from "./HazeOutlook";
import Hero from "./Hero";
import LiveViews from "./LiveViews";
import PlanDay from "./PlanDay";
import RegionChips from "./RegionChips";
import { useCameras } from "./useCameras";
import { useNow } from "./useNow";
import { Section, cap } from "./ui";
import { usePrefs, useStored } from "./usePrefs";

const SgMap = dynamic(() => import("./SgMap"), {
  ssr: false,
  loading: () => <div className="mx-4 h-[300px] animate-pulse rounded-3xl bg-line lg:h-[calc(100dvh-12rem)] lg:min-h-[420px] lg:flex-none" />,
});

/** The two maps of the panel that shows one at a time from lg up. */
type MapView = "readings" | "origin";
const MAP_VIEWS: readonly MapView[] = ["readings", "origin"];
const MAP_OPTIONS = [
  { id: "readings", label: "Readings now" },
  { id: "origin", label: "Where the air came from" },
] as const;
/** From lg up: the shown map fills the panel, the other is hidden. */
const panel = (on: boolean) => (on ? "lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : "lg:hidden");

/** The Now tab: the answer for the chosen region, what to do, what is in the air and where it came from. */
export default function NowView({ generatedAt, history, nea, hourly, weather, days, sensors, aqiStations, stations }: { generatedAt: string; history: NeaPm25History | null; nea: NeaNow | null; hourly: ForecastPoint[]; weather: WeatherHour[]; days: DayOutlook[]; sensors: Sensor[]; aqiStations: AqiStation[]; stations: Station[] }) {
  const cameras = useCameras() ?? [];
  const now = useNow(generatedAt);
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs(nea ? islandMax(nea.psi24)?.region : undefined);

  const { latest, psi, level } = currentReading({ history, nea }, region);
  const step = adviceStep(latest?.value ?? null, psi, group);

  const [view, setView] = useStored<MapView>("map-view", MAP_VIEWS, "origin");

  // Phones read one column in the order below (order-*). From lg up there are two columns: everything but the maps on the left, in that same order,
  // and one tall map panel on the right that stays in view while the page scrolls. The panel's switch picks which map it shows; below lg
  // its wrappers are `contents` and the switch is hidden, so both maps keep their place in the single column.
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(440px,520px)_minmax(0,1fr)] lg:items-start lg:gap-x-4 2xl:grid-cols-[minmax(520px,600px)_minmax(0,1fr)]">
      <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col">
        <div className="order-1">
          <RegionChips history={history} region={region} onPick={setRegion} onLocate={locate} locating={locating} />
        </div>
        <div className="order-2">
          <Hero
            region={region}
            now={now}
            weather={weather}
            readingTime={latest?.time ?? null}
            pm25={latest?.value ?? null}
            psi={psi}
            trend={trend3h(history?.regions[region])}
            group={group}
            onGroup={setGroup}
            next={fromHour(hourly, now).slice(0, 6)}
          />
        </div>
        <div className="order-4 mt-6">
          <HazeOutlook days={days} psiNow={nea ? (islandMax(nea.psi24)?.psi ?? null) : null} />
        </div>
        <Section id="plan" className="order-5 !mt-8" title="Plan your day">
          <PlanDay hourly={hourly} weather={weather} group={group} now={now} />
        </Section>

        {level != null && step != null && (
          <Section id="what-to-do" className="order-6" title="What to do">
            <Advice items={tips(level, step, group, psi != null ? psiLevel(psi) : null)} />
          </Section>
        )}

        <div className="order-7">
          <CigaretteCard region={region} pm25={latest?.value} today={history?.regions[region]} />
        </div>

        {cameras.length > 0 && (
          <Section className="order-9" title="Live views">
            <LiveViews cameras={cameras} region={region} />
            <Link href="/photos" className="mt-2 block px-5 text-label font-semibold text-accent">
              Camera viewer
            </Link>
          </Section>
        )}

        {nea && (
          <Section className="order-10" title={`What is in the air, ${cap(region)}`}>
            <AirDetail nea={nea} region={region} />
          </Section>
        )}
      </div>

      <div className="contents lg:sticky lg:top-[calc(3.5rem+env(safe-area-inset-top))] lg:col-start-2 lg:row-start-1 lg:flex lg:h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] lg:flex-col lg:pt-3">
        {/* Tabs in the sections' heading style, so they do not read as a second tray next to the map's own PM2.5 / US AQI one. */}
        <div role="group" aria-label="Choose the map" className="hidden gap-6 px-4 pb-3 lg:flex">
          {MAP_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={o.id === view}
              onClick={() => setView(o.id)}
              className={`min-h-[44px] border-b-[3px] text-balance text-left text-[22px] font-bold tracking-tight ${o.id === view ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Section id="across" className={`order-8 ${panel(view === "readings")}`} headClass="lg:sr-only" title="Across Singapore">
          <SgMap history={history} psi24={nea?.psi24 ?? null} region={region} onPick={setRegion} sensors={sensors} aqiStations={aqiStations} stations={stations} cameras={cameras} />
        </Section>

        <HazeOrigin className={`order-11 ${panel(view === "origin")}`} nea={nea} history={history} stations={stations} sensors={sensors} />
      </div>
    </div>
  );
}
