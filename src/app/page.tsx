import Dashboard from "@/components/Dashboard";
import { getHazeData } from "@/lib/data";

export const revalidate = 300; // refresh data every 5 minutes

export default async function Home() {
  const data = await getHazeData();
  return <Dashboard data={data} />;
}
