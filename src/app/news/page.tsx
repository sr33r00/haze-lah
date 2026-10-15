import AppShell from "@/components/AppShell";
import NewsView from "@/components/NewsView";
import { getHazeData } from "@/lib/data";
import { buildTimeline, unhealthyStreak } from "@/lib/situation";

export const metadata = { title: "Haze news · Haze Lah" };
export const revalidate = 300;

export default async function News() {
  const data = await getHazeData();
  const values = data.nea ? Object.values(data.nea.psi24).filter((v) => !isNaN(v)) : [];
  const psi = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  return (
    <AppShell data={data} title="News">
      <NewsView items={buildTimeline(data)} streak={unhealthyStreak(data.psiDaily)} psi={psi} />
    </AppShell>
  );
}
