import GlanceView from "@/components/GlanceView";
import { getHazeData } from "@/lib/data";

export const metadata = { title: "Haze Lah glance" };
export const revalidate = 300;

export default async function Glance() {
  return <GlanceView data={await getHazeData()} />;
}
