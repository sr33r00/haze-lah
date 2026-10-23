import { fetchCameras } from "@/lib/sources/traffic";

// Fetched by the page on load, not built into it: the photo links change every 5 minutes, but the pages are rebuilt only every 30 to 60 minutes.
export const dynamic = "force-dynamic";

export async function GET() {
  // Mock mode has no traffic cameras (their photos need the network).
  if (process.env.HAZE_MOCK === "1") return Response.json([]);
  try {
    return Response.json(await fetchCameras(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
  } catch (e) {
    console.error("[haze] cameras:", e);
    return Response.json([], { status: 502 });
  }
}
