import { fetchCameraPhoto } from "@/lib/sources/traffic";

// Photos pass through here so the browser never loads LTA's links directly. The CDN keeps each one for 2 minutes,
// so however many people look, upstream sees about one request per camera per 2 minutes per CDN region.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,6}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetchCameraPhoto(id);
    if (!res) return new Response("Not found", { status: 404 });
    return new Response(res.body, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (e) {
    console.error("[haze] camera photo:", e);
    return new Response("Photo unavailable", { status: 502 });
  }
}
