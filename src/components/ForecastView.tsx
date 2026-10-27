"use client";

import { useEffect, useMemo, useState } from "react";
import type { Accuracy } from "@/lib/accuracy";
import { answerText, bestWindow, instrumentHours, latestObserved, peakAhead, shortLeadNote, skillRows } from "@/lib/forecastHours";
import { fmtDayHour } from "@/lib/format";
import { HISTORY_URL, sinceWhen } from "@/lib/psiRecords";
import { OUTLOOK_NOTE, fetchReplay } from "@/lib/replay";
import type { DayOutlook, DayPsi, ForecastPoint, NeaPm25History, OutlookStep, WeatherHour } from "@/lib/types";
import Instrument from "./forecast/Instrument";
import Skill from "./forecast/Skill";
import Outlook from "./Outlook";
import PsiWeek from "./PsiWeek";
import { Section } from "./ui";
import { usePrefs } from "./usePrefs";

/** The Forecast tab: the answer, the 48-hour instrument, 5 days, how sure we are and the past week. */
export default function ForecastView(props: {
  history: NeaPm25History | null;
  hourly: ForecastPoint[];
  weather: WeatherHour[];
  days: DayOutlook[];
  psiDaily: DayPsi[];
  accuracy: Accuracy | null;
  bias: number | null;
  sigma: number | null;
  savedFrom: string | null;
}) {
  const { group } = usePrefs();
  const { history, hourly, weather } = props;
  // The wind outlook comes from the browser-side replay, fetched once and shared by the instrument and the 5 days.
  const [outlook, setOutlook] = useState<{ steps: OutlookStep[] | null; failed: boolean }>({ steps: null, failed: false });
  useEffect(() => {
    fetchReplay().then(
      (r) => setOutlook(r.outlook?.length ? { steps: r.outlook, failed: false } : { steps: null, failed: true }),
      () => setOutlook({ steps: null, failed: true }),
    );
  }, []);
  const hours = useMemo(() => instrumentHours(history?.island ?? [], hourly, weather, outlook.steps), [history, hourly, weather, outlook.steps]);
  const leadNote = useMemo(() => shortLeadNote(skillRows(props.accuracy)), [props.accuracy]);
  const answer = useMemo(() => answerText(peakAhead(hours), bestWindow(hours), new Date(), latestObserved(hours), leadNote), [hours, leadNote]);
  const weekPeak = Math.max(0, ...props.psiDaily.map((d) => d.max));
  const since = sinceWhen(weekPeak);
  return (
    <div className="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-8">
      <div className="mt-6 px-4 lg:mt-10 lg:pt-1">
        <p className="text-balance text-[22px] font-bold leading-snug tracking-tight">{answer.headline}</p>
        <p className="mt-1 text-body text-muted">{answer.tip}</p>
      </div>

      <Section title="Next 48 hours" aside="PM2.5 µg/m³, island-wide">
        <div className="px-4">
          <Instrument hours={hours} windFailed={outlook.failed} />
          {hours.length > 0 && outlook.steps && <p className="mt-1 text-label text-muted">{OUTLOOK_NOTE}</p>}
          {props.savedFrom && <p className="mt-1 text-label text-muted">Saved forecast from {fmtDayHour(props.savedFrom)}. The live model is not answering.</p>}
        </div>
      </Section>

      <div className="lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title="Next 5 days">
          <Outlook days={props.days} group={group} outlook={outlook.steps} />
        </Section>
        <Skill accuracy={props.accuracy} bias={props.bias} sigma={props.sigma} />
      </div>

      <Section className="lg:col-span-2" title="Last 7 days" aside="Peak 24-hr PSI">
        <PsiWeek days={props.psiDaily} />
        {since && (
          <p className="mt-2 px-4 text-label text-muted">
            This week&apos;s peak {weekPeak} is the {since[0].toLowerCase() + since.slice(1)}.{" "}
            <a href={HISTORY_URL} target="_blank" rel="noreferrer" className="link">
              NEA data
            </a>
          </p>
        )}
      </Section>
    </div>
  );
}
