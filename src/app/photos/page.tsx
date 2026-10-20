import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import GroundViews from "@/components/GroundViews";
import { Section } from "@/components/ui";
import { getHazeData } from "@/lib/data";

export const metadata = pageMeta(
  "Haze photos: live cameras in Singapore",
  "See the haze on the ground: live LTA traffic camera photos and webcams around Singapore.",
  "/photos",
);
export const revalidate = 300;

export default async function Photos() {
  const data = await getHazeData();
  return (
    <AppShell data={data} title="Photos">
      <Section id="ground" title="On the ground">
        <GroundViews cameras={data.cameras} />
      </Section>
    </AppShell>
  );
}
