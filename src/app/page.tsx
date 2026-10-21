import AppShell from "@/components/AppShell";
import Footer from "@/components/Footer";
import NowView from "@/components/NowView";
import { getHazeData } from "@/lib/data";

export const revalidate = 300; // refresh data every 5 minutes

export default async function Home() {
  const data = await getHazeData();
  return (
    <AppShell data={data}>
      <NowView history={data.history} nea={data.nea} hourly={data.forecast.hourly} days={data.forecast.days} sensors={data.sensors} stations={data.stations} cameras={data.cameras} supporters={data.supporters} />
      <Footer errors={data.errors} />
    </AppShell>
  );
}
