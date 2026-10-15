"use client";

import { pm25ToLevel, psiLevel } from "@/lib/bands";
import { tips } from "@/lib/advice";
import { trend3h } from "@/lib/format";
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

  const latest = history?.regions[region].at(-1) ?? null;
  const rawPsi = nea?.psi24[region];
  const psi = rawPsi != null && !isNaN(rawPsi) ? rawPsi : null;
  // NEA: 1-hr PM2.5 guides immediate activities; fall back to 24-hr PSI.
  const level = latest ? pm25ToLevel(latest.value) : psi != null ? psiLevel(psi) : null;

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

      <CigaretteCard region={region} pm25={nea?.pm25_24h[region]} />

      {level != null && (
        <Section title="What to do">
          <Advice items={tips(level, group)} />
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
