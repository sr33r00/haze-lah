import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import FromSpace from "@/components/FromSpace";
import GroundViews from "@/components/GroundViews";
import { Section } from "@/components/ui";
import { getHazeData } from "@/lib/data";
import { islandSummary } from "@/lib/situation";

export const metadata = pageMeta(
  "Haze photos: live cameras in Singapore",
  "See the haze on the ground: live LTA traffic camera photos and webcams around Singapore, and the smoke from space.",
  "/photos",
);
export const revalidate = 1800;

export default async function Photos() {
  const data = await getHazeData();
  return (
    <AppShell data={data} title="Photos">
      <Section id="ground" title="On the ground">
        <GroundViews />
      </Section>
      <FromSpace pm25={islandSummary(data)?.peak?.value ?? null} psiDaily={data.psiDaily} />
    </AppShell>
  );
}
