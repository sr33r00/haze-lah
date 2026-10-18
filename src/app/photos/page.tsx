import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import LiveViews from "@/components/LiveViews";
import SatelliteView from "@/components/SatelliteView";
import { Section } from "@/components/ui";
import { getHazeData } from "@/lib/data";
import { dailyImages, liveImage } from "@/lib/satellite";

export const metadata = pageMeta(
  "Haze photos: satellite images and live cameras in Singapore",
  "See the haze: daily NASA satellite images of the smoke over Sumatra, Singapore and Borneo, the latest Himawari image, and live LTA camera photos.",
  "/photos",
);
export const revalidate = 300;

export default async function Photos() {
  const data = await getHazeData();
  const now = Date.now();
  return (
    <AppShell data={data} title="Photos">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <Section title="From space">
          <SatelliteView daily={dailyImages(now)} live={liveImage(now)} />
        </Section>
        {data.cameras.length > 0 && (
          <Section title="Road cameras">
            <LiveViews cameras={data.cameras} grid />
          </Section>
        )}
      </div>
    </AppShell>
  );
}
