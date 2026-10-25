import { mockGrid } from "@/lib/mock";
import { fetchSmokeGrid } from "@/lib/sources/openmeteo";

// Cached at Cloudflare's edge for an hour (ISR): about 250 KB (74 KB gzipped) with the six gases, and the upstream data changes every 3 hours.
// The upstream smoke and wind requests also sit in the fetch cache for 3 hours. A failed rebuild (Open-Meteo sometimes answers "overloaded")
// throws, so the last good copy keeps being served.
export const revalidate = 3600;

export async function GET() {
  try {
    return Response.json(process.env.HAZE_MOCK === "1" ? mockGrid() : await fetchSmokeGrid());
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    throw e;
  }
}
