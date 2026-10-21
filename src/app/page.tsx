import AppShell from "@/components/AppShell";
import Footer from "@/components/Footer";
import NowView from "@/components/NowView";
import { getHazeData } from "@/lib/data";
import { REPLAY_URL } from "@/lib/replay";

export const revalidate = 300; // refresh data every 5 minutes

export default async function Home() {
  const data = await getHazeData();
  return (
    <AppShell data={data}>
      <link rel="preload" as="fetch" href={REPLAY_URL} crossOrigin="anonymous" /> {/* "Where today's air came from" asks for it as soon as the page runs */}
      <NowView history={data.history} nea={data.nea} hourly={data.forecast.hourly} days={data.forecast.days} sensors={data.sensors} stations={data.stations} cameras={data.cameras} />
      <Footer errors={data.errors} />
    </AppShell>
  );
}
