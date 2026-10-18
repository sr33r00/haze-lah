import { WEBCAM_TTL, fetchWebcams } from "@/lib/sources/windy";

// Fetched by the page on load, so the expiring image URLs are never older than the cache below.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await fetchWebcams(), { headers: { "Cache-Control": `public, s-maxage=${WEBCAM_TTL}` } });
  } catch (e) {
    console.error("[haze] webcams:", e);
    return Response.json([], { status: 502 });
  }
}
