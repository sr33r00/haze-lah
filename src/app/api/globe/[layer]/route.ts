import { globeDates } from "@/lib/globe";
import { fetchGlobePicture } from "@/lib/sources/gibsTexture";
import { cacheControl, layerOf } from "../shared";

// One frame per day for the last week; no `date` is the newest. Built on request, kept in the data cache by fetchGlobePicture and by the CDN.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ layer: string }> }) {
  const layer = await layerOf(ctx);
  if (!layer) return Response.json({ error: "Unknown layer" }, { status: 404 });
  const dates = globeDates(Date.now());
  const date = new URL(req.url).searchParams.get("date") ?? dates.at(-1)!;
  if (!dates.includes(date)) return Response.json({ error: "Unknown date" }, { status: 400 });
  try {
    const { webp, complete } = await fetchGlobePicture(layer, date);
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": cacheControl(date, complete) } });
  } catch (e) {
    console.error("[haze] globe picture:", e);
    return Response.json({ error: "Satellite data unavailable" }, { status: 502 });
  }
}
