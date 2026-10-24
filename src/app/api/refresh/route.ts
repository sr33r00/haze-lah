import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { HAZE_DATA_TAG } from "@/lib/data";

/**
 * Called by the Cloudflare Worker in `workers/nea-refresh`, and only when NEA has published new data. It clears the
 * shared data build and the pages; the Worker then loads them so the rebuild starts at once.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the request carries `Authorization: Bearer <secret>`; compared in constant time. */
function authorised(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function POST(req: Request) {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) return Response.json({ error: "REFRESH_SECRET is not set" }, { status: 503, headers: NO_STORE });
  if (!authorised(req, secret)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  revalidateTag(HAZE_DATA_TAG);
  revalidatePath("/", "layout");
  return Response.json({ refreshed: true }, { headers: NO_STORE });
}
