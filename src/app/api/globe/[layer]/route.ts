import { fetchGlobeTexture } from "@/lib/sources/gibsTexture";

// Built on request and cached by the CDN for 6 hours (NASA adds a day's passes once a day). The multi-MB source
// pictures are fetched and averaged here, so the browser only ever downloads the finished texture.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ layer: string }> }) {
  const { layer } = await params;
  if (layer !== "co" && layer !== "smoke") return Response.json({ error: "Unknown layer" }, { status: 404 });
  try {
    const jpeg = await fetchGlobeTexture(layer);
    return new Response(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("[haze] globe texture:", e);
    return Response.json({ error: "Satellite data unavailable" }, { status: 502 });
  }
}
