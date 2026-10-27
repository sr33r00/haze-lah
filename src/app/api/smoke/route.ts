import { smokeText } from "@/lib/smokeData";

// Cached at Cloudflare's edge for an hour (ISR): about 250 KB (74 KB gzipped) with the six gases, and the upstream data changes every 3 hours.
// The hourly job stores the grid in the bucket; without a recent stored copy it is built now (the upstream requests sit in the fetch cache for
// 3 hours). A failed rebuild (Open-Meteo sometimes answers "overloaded") throws, so the last good copy keeps being served.
export const revalidate = 3600;

export async function GET() {
  try {
    return new Response(await smokeText(), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[haze] smoke grid:", e);
    throw e;
  }
}
