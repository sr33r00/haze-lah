import AppShell from "@/components/AppShell";
import ForecastView from "@/components/ForecastView";
import { fetchAccuracy } from "@/lib/accuracy";
import { getHazeData } from "@/lib/data";

export const metadata = { title: "Haze forecast · Haze Lah" };
export const revalidate = 300;

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
