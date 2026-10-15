"use client";

import { tips } from "@/lib/advice";
import { trend3h } from "@/lib/format";
import { psiLevel } from "@/lib/bands";
import { currentReading } from "@/lib/situation";
import type { ForecastPoint, NeaNow, NeaPm25History } from "@/lib/types";
import AirDetail from "./AirDetail";
import Advice from "./Advice";
import CigaretteCard from "./CigaretteCard";
import Hero from "./Hero";
import PlanDay from "./PlanDay";
import RegionChips from "./RegionChips";
import { Section, cap } from "./ui";
import { usePrefs } from "./usePrefs";

/** The Now tab: the answer for the chosen region, what to do, and what is in the air. */
export default function NowView({ history, nea, hourly }: { history: NeaPm25History | null; nea: NeaNow | null; hourly: ForecastPoint[] }) {
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs();

  const { latest, psi, level } = currentReading({ history, nea }, region);

  return (
    <>
      <RegionChips history={history} region={region} onPick={setRegion} onLocate={locate} locating={locating} />
      <Hero
        region={region}
        readingTime={latest?.time ?? null}
        pm25={latest?.value ?? null}
        psi={psi}
        trend={trend3h(history?.regions[region])}
        level={level}
        group={group}
        onGroup={setGroup}
        next={hourly.slice(0, 6)}
      />

      <CigaretteCard region={region} pm25={nea?.pm25_24h[region]} today={history?.regions[region]} />

      {level != null && (
        <Section title="What to do">
          <Advice items={tips(level, group, psi != null ? psiLevel(psi) : null)} />
        </Section>
      )}

      <Section title="Plan your day">
        <PlanDay hourly={hourly} group={group} />
      </Section>

      {nea && (
        <Section title={`What is in the air, ${cap(region)}`}>
          <AirDetail nea={nea} region={region} />
        </Section>
      )}
    </>
  );
}
