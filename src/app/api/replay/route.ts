import { replayText } from "@/lib/replayData";

// Cached at Cloudflare's edge for 15 minutes (ISR): the hourly job stores the replay in the bucket, so a rebuild here is a bucket read, and a
// shorter period keeps the page within about an hour and a quarter of the data. Without a recent stored copy it is built now. A failed
// rebuild throws, so the last good copy keeps being served.
export const revalidate = 900;

export async function GET() {
  try {
    return new Response(await replayText(), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[haze] replay:", e);
    throw e;
  }
}
