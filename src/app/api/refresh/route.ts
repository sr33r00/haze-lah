import { revalidatePath, revalidateTag } from "next/cache";
import { HAZE_DATA_TAG } from "@/lib/data";
import { NO_STORE, refuse } from "@/lib/routeAuth";

/**
 * Called by the Cloudflare Worker in `workers/nea-refresh`, and only when NEA has published new data. It clears the
 * shared data build and the pages; the Worker then loads them so the rebuild starts at once.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = refuse(req);
  if (denied) return denied;

  revalidateTag(HAZE_DATA_TAG);
  revalidatePath("/", "layout");
  return Response.json({ refreshed: true }, { headers: NO_STORE });
}
