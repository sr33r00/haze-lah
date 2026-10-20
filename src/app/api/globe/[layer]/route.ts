import { GLOBE_LAYERS, globeDates, type GlobeLayer } from "@/lib/globe";
import { fetchGlobeTexture } from "@/lib/sources/gibsTexture";
import { sgDate } from "@/lib/util";

// One frame per day for the last week; no `date` is the newest. Built on request and cached by the CDN. The
// multi-MB source pictures are fetched and averaged here, so the browser only ever downloads the finished texture.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECENT = "public, s-maxage=21600, stale-while-revalidate=86400"; // NASA adds a day's passes once a day
const PARTIAL = "public, s-maxage=300"; // something upstream failed: try again soon
const SETTLED = "public, s-maxage=604800, stale-while-revalidate=2592000"; // a day older than 2 days will not change

export async function GET(req: Request, { params }: { params: Promise<{ layer: string }> }) {
  const { layer } = await params;
  if (!Object.hasOwn(GLOBE_LAYERS, layer)) return Response.json({ error: "Unknown layer" }, { status: 404 });
  const dates = globeDates(Date.now());
  const date = new URL(req.url).searchParams.get("date") ?? dates.at(-1)!;
  if (!dates.includes(date)) return Response.json({ error: "Unknown date" }, { status: 400 });
  try {
    const { jpeg, complete } = await fetchGlobeTexture(layer as GlobeLayer, date);
    return new Response(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": !complete ? PARTIAL : date < sgDate(-2) ? SETTLED : RECENT },
    });
  } catch (e) {
    console.error("[haze] globe texture:", e);
    return Response.json({ error: "Satellite data unavailable" }, { status: 502 });
  }
}
