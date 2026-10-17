import { buildReplay } from "@/lib/replay";
import { fetchFirePoints } from "@/lib/sources/firms";
import { fetchPastWind } from "@/lib/sources/openmeteo";

// Same caching approach as /api/smoke: upstream requests sit in the fetch cache, the CDN holds the result.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [wind, fires] = await Promise.all([fetchPastWind(), fetchFirePoints()]);
    return Response.json(buildReplay(wind, fires ?? []), { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] replay:", e);
    return Response.json({ error: "Replay unavailable" }, { status: 502 });
  }
}
