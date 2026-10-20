"use client";

import dynamic from "next/dynamic";
import type { DayPsi, FireSummary, NeaNow, Sensor, Station } from "@/lib/types";
import { windVerdict } from "@/lib/context";
import FireTrend from "./FireTrend";
import Neighbours from "./Neighbours";
import { Section } from "./ui";
import SpaceView from "./SpaceView";
import WindDial from "./WindDial";

const SmokeMap = dynamic(() => import("./SmokeMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse bg-line lg:col-start-1 lg:row-span-3 lg:h-[max(560px,calc(100vh-15rem))]" />,
});

/** The Map tab: smoke forecast, wind, fires, a 3D globe of NASA pollution data and neighbouring readings. */
export default function MapView(props: {
  fires: FireSummary;
  stations: Station[];
  sensors: Sensor[];
  psi24: NeaNow["psi24"] | null;
  psiDaily: DayPsi[];
  biasFactor: number | null;
  windDir: number | null;
  context: string | null;
  now: number;
}) {
  const { windDir, context } = props;
  return (
    <>
      <Section title="Smoke and fires" aside="Past 5 days to next 3">
        <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-6 lg:px-4">
          <SmokeMap fires={props.fires} stations={props.stations} sensors={props.sensors} psi24={props.psi24} psiDaily={props.psiDaily} biasFactor={props.biasFactor} />
          <div className="mt-4 flex items-center gap-4 px-4 lg:col-start-2 lg:mt-0 lg:px-0">
            {windDir != null && <WindDial windDir={windDir} />}
            <div className="min-w-0 text-[15px]">
              {windDir != null && <p className="font-bold">{windVerdict(windDir)}</p>}
              {context && <p className="mt-1 text-muted">{context}</p>}
            </div>
          </div>
          {props.fires.available && <FireTrend daily={props.fires.daily} />}
        </div>
      </Section>

      <Section id="space" title="From space" aside="NASA satellites">
        <SpaceView now={props.now} fires={props.fires.points} />
      </Section>

      <Section title="Neighbours">
        <Neighbours stations={props.stations} />
      </Section>
    </>
  );
}
