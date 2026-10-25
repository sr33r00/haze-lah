import { fetchCameras } from "@/lib/sources/traffic";

// Fetched by the page on load, not built into it: the photo links change every 5 minutes. Cached at Cloudflare's edge for 5 minutes (ISR),
// so data.gov.sg is asked about once per period, not per visitor. A failed rebuild throws, so the last good list keeps being served.
export const revalidate = 300;

export async function GET() {
  // Mock mode has no traffic cameras (their photos need the network).
  if (process.env.HAZE_MOCK === "1") return Response.json([]);
  try {
    return Response.json(await fetchCameras());
  } catch (e) {
    console.error("[haze] cameras:", e);
    throw e;
  }
}
