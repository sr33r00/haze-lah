import AppShell from "@/components/AppShell";
import Footer from "@/components/Footer";
import NowView from "@/components/NowView";
import { getHazeData } from "@/lib/data";

export const revalidate = 300; // refresh data every 5 minutes

export default async function Home() {
  const data = await getHazeData();
  return (
    <AppShell data={data}>
      <NowView history={data.history} nea={data.nea} hourly={data.forecast.hourly} sensors={data.sensors} stations={data.stations} cameras={data.cameras} />
      <Footer errors={data.errors} />
    </AppShell>
  );
}
