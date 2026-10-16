import { mockGrid } from "@/lib/mock";
import { fetchSmokeGrid } from "@/lib/sources/openmeteo";

// CAMS updates twice a day and the upstream requests are cached for 3 hours, but the response itself is
// rebuilt every 10 minutes, so one failed wind request does not hide the wind layer for hours.
export const revalidate = 600;

export async function GET() {
  try {
    const grid = process.env.HAZE_MOCK === "1" ? mockGrid() : await fetchSmokeGrid();
    return Response.json(grid, { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    return Response.json({ error: "Smoke forecast unavailable" }, { status: 502 });
  }
}
