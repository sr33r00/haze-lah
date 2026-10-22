import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import ForecastView from "@/components/ForecastView";
import { fetchAccuracy } from "@/lib/accuracy";
import { getHazeData } from "@/lib/data";

export const metadata = pageMeta(
  "Singapore haze forecast: next 48 hours and 5 days",
  "Hour-by-hour PM2.5 for the next 48 hours and a 5-day PSI outlook for Singapore, calibrated against live NEA readings, with measured accuracy.",
  "/forecast",
);
export const revalidate = 1800;

export default async function Forecast() {
  const [data, accuracy] = await Promise.all([getHazeData(), fetchAccuracy()]);
  const day = accuracy?.leads.find((l) => l.lead === 24);
  return (
    <AppShell data={data} title="Forecast">
      <ForecastView
        history={data.history}
        hourly={data.forecast.hourly}
        days={data.forecast.days}
        psiDaily={data.psiDaily}
        skill24={day && day.ours.n >= 20 ? day : null}
      />
    </AppShell>
  );
}
