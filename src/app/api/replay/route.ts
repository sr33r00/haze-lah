import { getReplay } from "@/lib/replayData";

// Cached at Cloudflare's edge for 30 minutes (ISR): built once per period, not per visitor. A failed rebuild throws, so the last good copy keeps being served.
export const revalidate = 1800;

export async function GET() {
  try {
    return Response.json(await getReplay());
  } catch (e) {
    console.error("[haze] replay:", e);
    throw e;
  }
}
