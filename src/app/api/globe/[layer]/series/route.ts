import { WEEK, globeDates } from "@/lib/globe";
import { fetchGlobeSeries } from "@/lib/sources/gibsTexture";
import { cacheControl, layerOf } from "../../shared";

// The mean reading over Singapore of each frame's day, and of the week before the first, as { values: { date: number | null } }.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ layer: string }> }) {
  const layer = await layerOf(ctx);
  if (!layer) return Response.json({ error: "Unknown layer" }, { status: 404 });
  const dates = globeDates(Date.now(), WEEK);
  try {
    const { values, complete } = await fetchGlobeSeries(layer, dates);
    return Response.json({ values }, { headers: { "Cache-Control": cacheControl(dates.at(-1)!, complete) } });
  } catch (e) {
    console.error("[haze] globe series:", e);
    return Response.json({ error: "Satellite data unavailable" }, { status: 502 });
  }
}
