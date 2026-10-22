import { getHazeData } from "@/lib/data";

export const revalidate = 1800;

export async function GET() {
  const data = await getHazeData();
  return Response.json(data, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "s-maxage=1800, stale-while-revalidate=600" },
  });
}
