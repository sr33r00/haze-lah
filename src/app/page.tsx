import Dashboard from "@/components/Dashboard";
import { fetchAccuracy } from "@/lib/accuracy";
import { getHazeData } from "@/lib/data";

export const revalidate = 300; // refresh data every 5 minutes

export default async function Home() {
  const [data, accuracy] = await Promise.all([getHazeData(), fetchAccuracy()]);
  const day = accuracy?.leads.find((l) => l.lead === 24);
  return <Dashboard data={data} skill24={day && day.ours.n >= 20 ? day : null} />;
}
