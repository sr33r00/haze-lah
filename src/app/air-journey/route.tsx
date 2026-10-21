import { ImageResponse } from "next/og";
import { JOURNEY_SIZE, JourneyCard } from "@/lib/journeyCard";
import { getReplay } from "@/lib/replayData";
import { RELIEF } from "@/lib/satellite";

// Same caching as /api/replay: upstream requests sit in the fetch cache, the CDN holds the picture.
export const dynamic = "force-dynamic";

/** The newest day of the replay as a shareable picture. */
export async function GET(req: Request) {
  try {
    const day = (await getReplay()).days.at(-1);
    if (!day) throw new Error("no replay day");
    // The relief map ships in public/; it is read from this origin and embedded, so the renderer needs no network.
    const map = await fetch(new URL(RELIEF, req.url));
    if (!map.ok) throw new Error("relief map");
    const relief = `data:image/jpeg;base64,${Buffer.from(await map.arrayBuffer()).toString("base64")}`;
    return new ImageResponse(<JourneyCard day={day} relief={relief} />, { ...JOURNEY_SIZE, headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[haze] air-journey:", e);
    return new Response("Picture unavailable", { status: 502 });
  }
}
