"use client";

import dynamic from "next/dynamic";
import type { FireSummary, NeaNow, Station } from "@/lib/types";
import { windVerdict } from "@/lib/context";
import FireTrend from "./FireTrend";
import Neighbours from "./Neighbours";
import { Section } from "./ui";
import WindDial from "./WindDial";

const SmokeMap = dynamic(() => import("./SmokeMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse bg-line" />,
});

/** The Map tab: smoke forecast, wind, fires and neighbouring readings. */
export default function MapView(props: {
  fires: FireSummary;
  stations: Station[];
  psi24: NeaNow["psi24"] | null;
  biasFactor: number | null;
  windDir: number | null;
  context: string | null;
}) {
  const { windDir, context } = props;
  return (
    <>
      <Section title="Next 72 hours" aside="PM2.5 forecast">
        <SmokeMap fires={props.fires} stations={props.stations} psi24={props.psi24} biasFactor={props.biasFactor} />
        <div className="mt-4 flex items-center gap-4 px-4">
          {windDir != null && <WindDial windDir={windDir} />}
          <div className="min-w-0 text-[15px]">
            {windDir != null && <p className="font-bold">{windVerdict(windDir)}</p>}
            {context && <p className="mt-1 text-muted">{context}</p>}
          </div>
        </div>
        {props.fires.available && <FireTrend daily={props.fires.daily} />}
      </Section>

      <Section title="Neighbours">
        <Neighbours stations={props.stations} />
      </Section>
    </>
  );
}
