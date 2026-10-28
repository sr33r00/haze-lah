"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { tips } from "@/lib/advice";
import { trend3h } from "@/lib/format";
import { adviceStep, psiLevel } from "@/lib/bands";
import { currentReading, islandMax } from "@/lib/situation";
import { dotData } from "@/lib/readings";
import type { AqiStation, DayOutlook, DayPsi, ForecastPoint, NeaNow, NeaPm25History, Sensor, Station, WeatherHour } from "@/lib/types";
import AirDetail from "./AirDetail";
import Advice from "./Advice";
import CigaretteCard from "./CigaretteCard";
import HazeOrigin from "./HazeOrigin";
import HazeOutlook from "./HazeOutlook";
import Hero from "./Hero";
import LiveViews from "./LiveViews";
import PlanDay from "./PlanDay";
import PollCard from "./PollCard";
import RegionChips from "./RegionChips";
import { useCameras } from "./useCameras";
import { useNow } from "./useNow";
import { Section, cap } from "./ui";
import { usePrefs, useStored } from "./usePrefs";
import { useWide } from "./useWide";

const SgMap = dynamic(() => import("./SgMap"), {
  ssr: false,
  loading: () => <div className="mx-4 h-[300px] animate-pulse rounded-3xl bg-line lg:mb-3 lg:h-auto lg:min-h-0 lg:flex-1" />,
});
// The air globe (MapLibre) is the origin tab's map from lg up; phones never load it.
const Globe = dynamic(() => import("./globe/MapScreen"), { ssr: false, loading: () => <div className="size-full rounded-3xl bg-[#02030a]" /> });

/** The two maps of the panel that shows one at a time from lg up. */
type MapView = "readings" | "origin";
const MAP_VIEWS: readonly MapView[] = ["readings", "origin"];
const MAP_OPTIONS = [
  { id: "readings", label: "Readings now" },
  { id: "origin", label: "Where the air came from" },
] as const;
/** From lg up: the shown map fills the panel, the other is hidden. The origin tab's own slot (the globe) is hidden below lg, where HazeOrigin takes its place. */
const panel = (on: boolean) => (on ? "lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : "lg:hidden");

/** The Now tab: the answer for the chosen region, what to do, what is in the air and where it came from. */
export default function NowView({ generatedAt, history, nea, hourly, weather, days, sensors, aqiStations, stations, psiDaily, summary }: { generatedAt: string; history: NeaPm25History | null; nea: NeaNow | null; hourly: ForecastPoint[]; weather: WeatherHour[]; days: DayOutlook[]; sensors: Sensor[]; aqiStations: AqiStation[]; stations: Station[]; psiDaily: DayPsi[]; summary: string[] }) {
  const cameras = useCameras() ?? [];
  const now = useNow(generatedAt);
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs(nea ? islandMax(nea.psi24)?.region : undefined);

  const { latest, psi, level } = currentReading({ history, nea }, region);
  const step = adviceStep(latest?.value ?? null, psi, group);

  const [view, setView] = useStored<MapView>("map-view", MAP_VIEWS, "origin");
  const wide = useWide();
  // A link to "/#origin" (the shared air journey) opens the origin tab where there are tabs, as FeedbackForm opens its form from the hash.
  useEffect(() => {
    if (!wide) return;
    const fromHash = () => location.hash === "#origin" && setView("origin");
    fromHash();
    addEventListener("hashchange", fromHash);
    return () => removeEventListener("hashchange", fromHash);
  }, [wide, setView]);
  const dots = useMemo(() => dotData({ nea, history, stations, sensors }), [nea, history, stations, sensors]); // the globe's reading dots, from the data this page already has

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
            hourly={hourly}
          />
        </div>
        <div className="order-3">
          <PollCard />
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
            <Link href="/photos" className="mt-2 block px-5 link text-label font-semibold">
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
              className={`min-h-[44px] border-b-[3px] text-balance text-left text-[22px] font-bold tracking-tight ${o.id === view ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Section id="across" className={`order-8 ${panel(view === "readings")}`} headClass="lg:sr-only" title="Across Singapore">
          <SgMap history={history} psi24={nea?.psi24 ?? null} region={region} onPick={setRegion} sensors={sensors} aqiStations={aqiStations} stations={stations} cameras={cameras} />
        </Section>

        {/* Below lg the smoke map section, mounted once the window is known to be narrow (until then a box of about its height, so the page below does not jump; it carries the id so a link to #origin lands here). From lg up the globe takes its place, and only while its tab is open. */}
        {wide === false && <HazeOrigin className="order-11 lg:hidden" nea={nea} history={history} stations={stations} sensors={sensors} />}
        {wide == null && <div id="origin" className="order-11 mt-10 min-h-[61rem] scroll-mt-20 lg:hidden" />}
        <div id={wide ? "origin" : undefined} className={`order-11 hidden px-4 ${view === "origin" ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pb-4" : ""}`}>
          <div className="min-h-0 flex-1">{wide && view === "origin" && <Globe embedded dots={dots} psiDaily={psiDaily} summary={summary} />}</div>
        </div>
      </div>
    </div>
  );
}
