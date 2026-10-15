"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pm25ToLevel, psiLevel } from "@/lib/bands";
import { ago, fmtTime } from "@/lib/format";
import type { ForecastPoint, HazeData } from "@/lib/types";
import Chart from "./Chart";
import Neighbours from "./Neighbours";
import NowStats from "./NowStats";
import Outlook from "./Outlook";
import RegionPicker from "./RegionPicker";
import Regions from "./Regions";
import { Card } from "./ui";
import { usePrefs } from "./usePrefs";
import Verdict from "./Verdict";
import Why from "./Why";

const sgHour = (t: string) => (new Date(t).getUTCHours() + 8) % 24;

/** Daytime hour with the cleanest forecast air in the next 12 h, if it is meaningfully cleaner. */
function cleanestHour(hourly: ForecastPoint[]): ForecastPoint | null {
  const day = hourly.slice(0, 12).filter((p) => sgHour(p.time) >= 6 && sgHour(p.time) <= 22);
  if (day.length < 3) return null;
  const min = day.reduce((a, b) => (b.pm25 < a.pm25 ? b : a));
  return Math.max(...day.map((p) => p.pm25)) - min.pm25 >= 15 ? min : null;
}

export default function Dashboard({ data }: { data: HazeData }) {
  const { region, setRegion, group, setGroup, locating, locate } = usePrefs();

  const latest = data.history?.regions[region].at(-1) ?? null;
  const rawPsi = data.nea?.psi24[region];
  const psi = rawPsi != null && !isNaN(rawPsi) ? rawPsi : null;
  // NEA: 1-hr PM2.5 guides immediate activities; fall back to 24-hr PSI.
  const level = latest ? pm25ToLevel(latest.value) : psi != null ? psiLevel(psi) : null;
  const best = useMemo(() => cleanestHour(data.forecast.hourly), [data.forecast.hourly]);

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-4">
      {data.mock && <div className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo data, not real readings.</div>}

      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          Haze<span className="text-muted">SG</span>
        </h1>
        <span className="text-xs text-muted">{latest ? `NEA reading ${fmtTime(latest.time)}` : "Updating"}</span>
      </header>

      <RegionPicker region={region} onPick={setRegion} onLocate={locate} locating={locating} />
      <Verdict level={level} group={group} onGroup={setGroup} best={best} />
      <NowStats pm25={latest?.value ?? null} psi={psi} />

      <Card title="Next 48 hours" aside={<span className="text-xs text-muted">PM2.5 µg/m³, island-wide</span>}>
        {data.history ? (
          <Chart observed={data.history.island} forecast={data.forecast.hourly.slice(0, 48)} />
        ) : (
          <p className="text-sm text-muted">Readings unavailable right now.</p>
        )}
      </Card>

      <Outlook days={data.forecast.days} group={group} />
      <Regions data={data} region={region} onPick={setRegion} />
      <Why data={data} />
      <Neighbours data={data} />

      <footer className="mt-6 space-y-2 text-center text-xs text-muted">
        <p suppressHydrationWarning>
          Data: NEA (data.gov.sg), Malaysia DOE APIMS, NASA FIRMS, Copernicus CAMS and ECMWF via Open-Meteo. Updated {ago(data.generatedAt)}.
        </p>
        <p>
          Not an official service. For official advisories see{" "}
          <a className="underline" href="https://www.haze.gov.sg" target="_blank" rel="noreferrer">
            haze.gov.sg
          </a>
          .
        </p>
        <p>
          <Link className="font-medium text-sky-600" href="/about">
            How this works, sources and forecast method
          </Link>
        </p>
        {data.errors.length > 0 && (
          <p className="text-amber-600">Some sources are unavailable: {data.errors.map((e) => e.split(":")[0]).join(", ")}.</p>
        )}
      </footer>
    </main>
  );
}
