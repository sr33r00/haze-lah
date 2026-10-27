import { isJob, runJob } from "@/lib/jobs";
import { NO_STORE, refuse } from "@/lib/routeAuth";

/**
 * The scheduled jobs, started by the Cloudflare Worker in `workers/nea-refresh` with the same bearer secret as `/api/refresh`:
 *   hourly    archive and score the forecast, send the alerts, keep the latest APIMS hour, send the owner the poll counts (once a day, privately) (`?test=1`: only a test alert)
 *   history   the air globe's history; `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default yesterday, SGT; at most 31 days)
 *   readings  the readings archive; same `from` and `to`
 * Answers with each step's result or error, and 500 when any step failed. Also the way to backfill by hand.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const denied = refuse(req);
  if (denied) return denied;
  const { job } = await ctx.params;
  if (!isJob(job)) return Response.json({ error: "Unknown job" }, { status: 404, headers: NO_STORE });
  const { ok, steps } = await runJob(job, new URL(req.url).searchParams);
  return Response.json({ job, ok, steps }, { status: ok ? 200 : 500, headers: NO_STORE });
}
