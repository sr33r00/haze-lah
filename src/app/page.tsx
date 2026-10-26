import AppShell from "@/components/AppShell";
import Footer from "@/components/Footer";
import NowView from "@/components/NowView";
import { getHazeData } from "@/lib/data";
import { REPLAY_URL } from "@/lib/replay";

export const revalidate = 1800; // rebuild every 30 minutes

export default async function Home() {
  const data = await getHazeData();
  return (
    <AppShell data={data} wide>
      <link rel="preload" as="fetch" href={REPLAY_URL} crossOrigin="anonymous" /> {/* "Where today's air came from" asks for it as soon as the page runs */}
      <NowView generatedAt={data.generatedAt} history={data.history} nea={data.nea} hourly={data.forecast.hourly} weather={data.weather} days={data.forecast.days} sensors={data.sensors} aqiStations={data.aqiStations} stations={data.stations} />
      <Footer errors={data.errors} />
    </AppShell>
  );
}
