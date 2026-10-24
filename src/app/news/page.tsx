import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import NewsView from "@/components/NewsView";
import { getHazeData } from "@/lib/data";
import { buildTimeline, islandSummary } from "@/lib/situation";
import { currentStreak } from "@/lib/streak";

export const metadata = pageMeta(
  "Singapore haze news and NEA updates",
  "Latest NEA haze advisories and news, plus a timeline of changes in Singapore PM2.5 levels and regional fire hotspots.",
  "/news",
);
export const revalidate = 1800;

export default async function News() {
  const data = await getHazeData();
  return (
    <AppShell data={data} title="News">
      <NewsView items={buildTimeline(data)} streak={await currentStreak(data.psiDaily)} psi={islandSummary(data)?.psi ?? null} />
    </AppShell>
  );
}
