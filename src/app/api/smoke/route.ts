import { mockGrid } from "@/lib/mock";
import { fetchSmokeGrid } from "@/lib/sources/openmeteo";

// Built on every request (the CDN still caches it for 10 minutes and the browser for 5). The upstream smoke and wind requests sit in
// the fetch cache for 3 hours, and when a refresh fails (Open-Meteo sometimes answers "overloaded") the last good
// copy keeps being served. Under ISR a rebuild would refetch without that fallback and could drop the wind.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const grid = process.env.HAZE_MOCK === "1" ? mockGrid() : await fetchSmokeGrid();
    return Response.json(grid, { headers: { "Cache-Control": "max-age=300, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    return Response.json({ error: "Smoke forecast unavailable" }, { status: 502 });
  }
}
