import { mockGrid } from "@/lib/mock";
import { fetchSmokeGrid } from "@/lib/sources/openmeteo";

// CAMS updates twice a day, so the regional grid is cached for 3 hours.
export const revalidate = 10800;

export async function GET() {
  try {
    const grid = process.env.HAZE_MOCK === "1" ? mockGrid() : await fetchSmokeGrid();
    return Response.json(grid, { headers: { "Cache-Control": "s-maxage=10800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    return Response.json({ error: "Smoke forecast unavailable" }, { status: 502 });
  }
}
