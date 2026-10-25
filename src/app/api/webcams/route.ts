import { fetchWebcams } from "@/lib/sources/windy";

// Fetched by the page on load. Cached at Cloudflare's edge for 5 minutes (ISR, the same as WEBCAM_TTL), so the expiring image URLs are never
// older than that. A failed rebuild throws, so the last good list keeps being served.
export const revalidate = 300;

export async function GET() {
  try {
    return Response.json(await fetchWebcams());
  } catch (e) {
    console.error("[haze] webcams:", e);
    throw e;
  }
}
