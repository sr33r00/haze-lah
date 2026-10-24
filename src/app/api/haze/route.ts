import { getHazeData } from "@/lib/data";

export const revalidate = 1800;

/** The Now page's data as JSON for any origin, without AQICN's stations: its terms forbid redistributing them. */
export async function GET() {
  const data = await getHazeData();
  return Response.json({ ...data, aqiStations: [] }, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "s-maxage=1800, stale-while-revalidate=600" },
  });
}
