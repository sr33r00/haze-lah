"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { pm25ToLevel, psiLevel } from "@/lib/bands";
import { ago, fmtTime, trend3h } from "@/lib/format";
import { mapContext, windVerdict } from "@/lib/context";
import { buildTimeline, unhealthyStreak } from "@/lib/situation";
import type { LeadScore } from "@/lib/accuracy";
import type { HazeData } from "@/lib/types";
import { tips } from "@/lib/advice";
import AirDetail from "./AirDetail";
import Advice from "./Advice";
import BottomNav from "./BottomNav";
import Chart from "./Chart";
import Hero from "./Hero";
import FireTrend from "./FireTrend";
import Neighbours from "./Neighbours";
import NewsTimeline from "./NewsTimeline";
import Outlook from "./Outlook";
import PlanDay from "./PlanDay";
import PsiWeek from "./PsiWeek";
import RegionChips from "./RegionChips";
import ShareButton from "./ShareButton";
import { Section, cap } from "./ui";
import { usePrefs } from "./usePrefs";
import WindDial from "./WindDial";

const SmokeMap = dynamic(() => import("./SmokeMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse bg-line" />,
});

export default function Dashboard({ data, skill24 }: { data: HazeData; skill24: LeadScore | null }) {
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs();

  const latest = data.history?.regions[region].at(-1) ?? null;
  const rawPsi = data.nea?.psi24[region];
  const psi = rawPsi != null && !isNaN(rawPsi) ? rawPsi : null;
  // NEA: 1-hr PM2.5 guides immediate activities; fall back to 24-hr PSI.
  const level = latest ? pm25ToLevel(latest.value) : psi != null ? psiLevel(psi) : null;

  const wind = data.weather[0] && !isNaN(data.weather[0].windDir) ? data.weather[0] : null;
  const context = mapContext(data);

  return (
    <div className="pb-24">
      <main className="mx-auto max-w-lg">
        <header className="flex items-center justify-between px-4 pb-3 pt-4">
          <div>
            <span className="block text-[19px] font-extrabold leading-tight tracking-tight">Haze Lah</span>
            <span className="text-[13px] text-muted">{latest ? `NEA reading at ${fmtTime(latest.time)}` : "Waiting for NEA"}</span>
          </div>
          <ShareButton />
        </header>
        {data.mock && <p className="mx-4 mb-3 rounded-xl bg-[var(--lv2)]/15 px-3 py-2 text-[13px]">Demo data. These are not real readings.</p>}

        <RegionChips history={data.history} region={region} onPick={setRegion} onLocate={locate} locating={locating} />
        <Hero
          region={region}
          readingTime={latest?.time ?? null}
          pm25={latest?.value ?? null}
          psi={psi}
          trend={trend3h(data.history?.regions[region])}
          level={level}
          group={group}
          onGroup={setGroup}
          next={data.forecast.hourly.slice(0, 6)}
        />

        {level != null && (
          <Section title="What to do">
            <Advice items={tips(level, group)} />
          </Section>
        )}

        <Section id="plan" title="Plan your day">
          <PlanDay hourly={data.forecast.hourly} group={group} />
        </Section>

        <Section id="news" title="Latest">
          <NewsTimeline items={buildTimeline(data)} streak={unhealthyStreak(data.psiDaily)} />
        </Section>

        <Section id="forecast" title="Next 48 hours" aside="PM2.5 µg/m³, island-wide">
          {data.history ? (
            <Chart observed={data.history.island} forecast={data.forecast.hourly.slice(0, 48)} />
          ) : (
            <p className="px-4 text-[15px] text-muted">NEA readings are unavailable right now.</p>
          )}
          {skill24 && (
            <p className="mt-2 px-4 text-[13px] text-muted">
              Track record: 24 hours ahead, off by {skill24.ours.mae} µg/m³ on average, against {skill24.persistence.mae} for assuming no change.{" "}
              <Link href="/about#accuracy" className="font-semibold text-accent underline">
                See accuracy
              </Link>
            </p>
          )}
        </Section>

        <Section title="Next 5 days">
          <Outlook days={data.forecast.days} group={group} />
        </Section>

        <Section title="Last 7 days" aside="Peak 24-hr PSI">
          <PsiWeek days={data.psiDaily} />
        </Section>

        <Section id="map" title="Smoke map" aside="Next 72 hours">
          <SmokeMap data={data} />
          <div className="mt-4 flex items-center gap-4 px-4">
            {wind && <WindDial windDir={wind.windDir} />}
            <div className="min-w-0 text-[15px]">
              {wind && <p className="font-bold">{windVerdict(wind.windDir)}</p>}
              {context && <p className="mt-1 text-muted">{context}</p>}
            </div>
          </div>
          {data.fires.available && <FireTrend daily={data.fires.daily} />}
        </Section>

        {data.nea && (
          <Section title={`What is in the air, ${cap(region)}`}>
            <AirDetail nea={data.nea} region={region} />
          </Section>
        )}

        <Section title="Neighbours">
          <Neighbours stations={data.stations} />
        </Section>

        <footer className="mt-12 space-y-3 px-6 text-center text-[13px] leading-relaxed text-muted">
          <p suppressHydrationWarning>
            Readings from NEA via data.gov.sg and Malaysia&apos;s Department of Environment. Fires from NASA FIRMS. Forecast from Copernicus CAMS and
            ECMWF via Open-Meteo. News from NEA and the Meteorological Service Singapore. Page updated {ago(data.generatedAt)}.
          </p>
          <p>
            An independent tool, not an official NEA service. For official advisories visit{" "}
            <a className="font-semibold text-accent underline" href="https://www.haze.gov.sg" target="_blank" rel="noreferrer">
              haze.gov.sg
            </a>
            , and NEA&apos;s daily{" "}
            <a className="font-semibold text-accent underline" href="https://www.nea.gov.sg/media/news/advisories" target="_blank" rel="noreferrer">
              haze updates
            </a>{" "}
            for the official 24-hour PSI outlook.
          </p>
          <p>
            <Link className="font-semibold text-accent underline" href="/about">
              How the forecast works
            </Link>
          </p>
          {data.errors.length > 0 && <p style={{ color: "var(--lv3)" }}>Not loading right now: {data.errors.join(", ")}.</p>}
        </footer>
      </main>
      <BottomNav />
    </div>
  );
}
