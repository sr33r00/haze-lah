import { mockGrid } from "@/lib/mock";
import { fetchSmokeGrid } from "@/lib/sources/openmeteo";

// Built on every request, but the CDN keeps the answer for an hour and serves it for 3 more while it refreshes (the browser keeps it for
// 5 minutes). It is about 250 KB (74 KB gzipped) with the six gases, and the upstream data changes every 3 hours, so a shorter CDN life
// only re-pulls it from the origin. The upstream smoke and wind requests sit in the fetch cache for 3 hours, and when a refresh fails (Open-Meteo sometimes answers "overloaded") the last good
// copy keeps being served. Under ISR a rebuild would refetch without that fallback and could drop the wind.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const grid = process.env.HAZE_MOCK === "1" ? mockGrid() : await fetchSmokeGrid();
    return Response.json(grid, { headers: { "Cache-Control": "max-age=300, s-maxage=3600, stale-while-revalidate=10800" } });
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    return Response.json({ error: "Smoke forecast unavailable" }, { status: 502 });
  }
}
