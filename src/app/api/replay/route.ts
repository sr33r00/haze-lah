import { getReplay } from "@/lib/replayData";

// Same caching approach as /api/smoke: upstream requests sit in the fetch cache, the CDN holds the result.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getReplay(), { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] replay:", e);
    return Response.json({ error: "Replay unavailable" }, { status: 502 });
  }
}
