"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeadScore } from "@/lib/accuracy";
import { fetchReplay } from "@/lib/replay";
import { HISTORY_URL, sinceWhen } from "@/lib/psiRecords";
import type { DayOutlook, DayPsi, ForecastPoint, NeaPm25History, OutlookStep } from "@/lib/types";
import Chart from "./Chart";
import Outlook from "./Outlook";
import PsiWeek from "./PsiWeek";
import { Section } from "./ui";
import { usePrefs } from "./usePrefs";
import WindOutlook from "./WindOutlook";

/** The Forecast tab: 48 hours, where the wind comes from, 5 days and the past week. */
export default function ForecastView(props: {
  history: NeaPm25History | null;
  hourly: ForecastPoint[];
  days: DayOutlook[];
  psiDaily: DayPsi[];
  skill24: LeadScore | null;
}) {
  const { group } = usePrefs();
  const { skill24 } = props;
  const [outlook, setOutlook] = useState<OutlookStep[] | null>(null);
  useEffect(() => {
    fetchReplay().then((r) => setOutlook(r.outlook?.length ? r.outlook : null), () => {}); // the request WindOutlook makes too
  }, []);
  const weekPeak = Math.max(0, ...props.psiDaily.map((d) => d.max));
  const since = sinceWhen(weekPeak);
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
      <Section className="lg:col-span-2" title="Next 48 hours" aside="PM2.5 µg/m³, island-wide">
        {props.history ? (
          <Chart observed={props.history.island} forecast={props.hourly.slice(0, 48)} />
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

      <Section className="lg:col-span-2" title="Where the wind comes from" aside="Next 3 days">
        <WindOutlook />
      </Section>

      <Section className="lg:col-start-1" title="Next 5 days">
        <Outlook days={props.days} group={group} outlook={outlook} />
      </Section>

      <Section className="lg:col-start-2 lg:row-start-3" title="Last 7 days" aside="Peak 24-hr PSI">
        <PsiWeek days={props.psiDaily} />
        {since && (
          <p className="mt-2 px-4 text-[13px] text-muted">
            This week&apos;s peak {weekPeak} is the {since[0].toLowerCase() + since.slice(1)}.{" "}
            <a href={HISTORY_URL} target="_blank" rel="noreferrer" className="underline">
              NEA data
            </a>
          </p>
        )}
      </Section>
    </div>
  );
}
