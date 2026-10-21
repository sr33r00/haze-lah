import { getReplay } from "@/lib/replayData";

// Same caching approach as /api/smoke: upstream requests sit in the fetch cache, the CDN holds the result, and the browser keeps it 5 minutes (max-age) so a return visit needs no request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getReplay(), { headers: { "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] replay:", e);
    return Response.json({ error: "Replay unavailable" }, { status: 502 });
  }
}
