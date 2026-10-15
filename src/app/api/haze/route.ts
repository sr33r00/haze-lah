import { getHazeData } from "@/lib/data";

export const revalidate = 300;

export async function GET() {
  const data = await getHazeData();
  return Response.json(data, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
