import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { HAZE_DATA_TAG, getHazeData } from "@/lib/data";
import { SITE_URL } from "@/lib/links";
import { isNewer } from "@/lib/refresh";
import { fetchNeaLatestHour } from "@/lib/sources/nea";

/**
 * Called every 5 minutes by cron-job.org. NEA publishes each hour's PM2.5 about 15 minutes past the hour, and the fixed
 * 30-minute ISR lagged up to about 40 minutes, so this rebuilds the pages as soon as NEA is ahead of the site.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the request carries `Authorization: Bearer <secret>`; compared in constant time. */
function authorised(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: Request) {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) return Response.json({ error: "REFRESH_SECRET is not set" }, { status: 503, headers: NO_STORE });
  if (!authorised(req, secret)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const site = (await getHazeData()).history?.island.at(-1)?.time ?? null;
  let nea: string | null = null;
  try {
    nea = await fetchNeaLatestHour();
  } catch (e) {
    console.error("[haze] refresh:", e);
  }

  const refreshed = isNewer(nea, site);
  if (refreshed) {
    revalidateTag(HAZE_DATA_TAG);
    revalidatePath("/", "layout");
    // Start the stale-while-revalidate rebuild now, rather than on the next visitor.
    await fetch(new URL("/", SITE_URL), { cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => {});
  }
  return Response.json({ refreshed, site, nea }, { headers: NO_STORE });
}
