import { fetchCameraPhoto } from "@/lib/sources/traffic";

// Photos pass through here so the browser never loads LTA's links directly. Each URL names a 5-minute step (`v`), and
// the CDN keeps it for that step, so however many people look, this runs about once per camera per step per CDN region.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,6}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetchCameraPhoto(id);
    if (!res) return new Response("Not found", { status: 404 });
    return new Response(res.body, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (e) {
    console.error("[haze] camera photo:", e);
    return new Response("Photo unavailable", { status: 502 });
  }
}
