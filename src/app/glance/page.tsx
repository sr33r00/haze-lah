import type { Metadata } from "next";
import GlanceView from "@/components/GlanceView";
import { getHazeData } from "@/lib/data";

export const metadata: Metadata = { title: "Glance", robots: { index: false, follow: true }, alternates: { canonical: "/" } };
export const revalidate = 300;

export default async function Glance() {
  return <GlanceView data={await getHazeData()} />;
}
