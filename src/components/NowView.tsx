"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { tips } from "@/lib/advice";
import { trend3h } from "@/lib/format";
import { adviceStep, psiLevel } from "@/lib/bands";
import { currentReading, islandMax } from "@/lib/situation";
import type { DayOutlook, ForecastPoint, NeaNow, NeaPm25History, Sensor, Station } from "@/lib/types";
import AirDetail from "./AirDetail";
import Advice from "./Advice";
import CigaretteCard from "./CigaretteCard";
import HazeOrigin from "./HazeOrigin";
import HazeOutlook from "./HazeOutlook";
import Hero from "./Hero";
import LiveViews from "./LiveViews";
import PlanDay from "./PlanDay";
import RegionChips from "./RegionChips";
import SupportCard from "./SupportCard";
import { Section, cap } from "./ui";
import { useCameras } from "./useCameras";
import { usePrefs } from "./usePrefs";

const SgMap = dynamic(() => import("./SgMap"), {
  ssr: false,
  loading: () => <div className="mx-4 h-[300px] animate-pulse rounded-3xl bg-line" />,
});

/** The Now tab: the answer for the chosen region, what to do, what is in the air and where it came from. */
export default function NowView({ history, nea, hourly, days, sensors, stations }: { history: NeaPm25History | null; nea: NeaNow | null; hourly: ForecastPoint[]; days: DayOutlook[]; sensors: Sensor[]; stations: Station[] }) {
  const cameras = useCameras() ?? [];
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs(nea ? islandMax(nea.psi24)?.region : undefined);

  const { latest, psi, level } = currentReading({ history, nea }, region);
  const step = adviceStep(latest?.value ?? null, psi, group);

  // Phones read one column in the order below (order-*); desktops keep two columns, where order does nothing.
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
      <div className="contents lg:block">
        <div className="order-1">
          <RegionChips history={history} region={region} onPick={setRegion} onLocate={locate} locating={locating} />
        </div>
        <div className="order-2">
          <Hero
            region={region}
            readingTime={latest?.time ?? null}
            pm25={latest?.value ?? null}
            psi={psi}
            trend={trend3h(history?.regions[region])}
            group={group}
            onGroup={setGroup}
            next={hourly.slice(0, 6)}
          />
        </div>
        <div className="order-3">
          <HazeOutlook days={days} psiNow={nea ? (islandMax(nea.psi24)?.psi ?? null) : null} />
        </div>
        <div className="order-6">
          <CigaretteCard region={region} pm25={nea?.pm25_24h[region]} today={history?.regions[region]} />
        </div>

        <Section className="order-7" title="Across Singapore">
          <SgMap history={history} psi24={nea?.psi24 ?? null} region={region} onPick={setRegion} sensors={sensors} stations={stations} cameras={cameras} />
        </Section>

        {cameras.length > 0 && (
          <Section className="order-8" title="Live views">
            <LiveViews cameras={cameras} region={region} />
            <Link href="/photos" className="mt-2 block px-5 text-[14px] font-semibold text-accent">
              Camera viewer
            </Link>
          </Section>
        )}
      </div>

      <div className="contents lg:block">
        <Section className="order-4 !mt-8 lg:!mt-3" title="Plan your day">
          <PlanDay hourly={hourly} group={group} />
        </Section>

        {level != null && step != null && (
          <Section id="what-to-do" className="order-5" title="What to do">
            <Advice items={tips(level, step, group, psi != null ? psiLevel(psi) : null)} />
          </Section>
        )}

        {nea && (
          <Section className="order-9" title={`What is in the air, ${cap(region)}`}>
            <AirDetail nea={nea} region={region} />
          </Section>
        )}

        <HazeOrigin className="order-10" nea={nea} history={history} stations={stations} sensors={sensors} />

        <SupportCard className="order-11 mt-10" />
      </div>
    </div>
  );
}
