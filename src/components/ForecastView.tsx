"use client";

import Link from "next/link";
import type { LeadScore } from "@/lib/accuracy";
import type { DayOutlook, DayPsi, ForecastPoint, NeaPm25History } from "@/lib/types";
import Chart from "./Chart";
import Outlook from "./Outlook";
import PsiWeek from "./PsiWeek";
import { Section } from "./ui";
import { usePrefs } from "./usePrefs";

/** The Forecast tab: 48 hours, 5 days and the past week. */
export default function ForecastView(props: {
  history: NeaPm25History | null;
  hourly: ForecastPoint[];
  days: DayOutlook[];
  psiDaily: DayPsi[];
  skill24: LeadScore | null;
}) {
  const { group } = usePrefs();
  const { skill24 } = props;
  return (
    <>
      <Section title="Next 48 hours" aside="PM2.5 µg/m³, island-wide">
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

      <Section title="Next 5 days">
        <Outlook days={props.days} group={group} />
      </Section>

      <Section title="Last 7 days" aside="Peak 24-hr PSI">
        <PsiWeek days={props.psiDaily} />
      </Section>
    </>
  );
}
