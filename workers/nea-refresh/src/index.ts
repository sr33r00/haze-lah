import { hasCurrentHour, sgtDate, signature, type NeaItem } from "./nea.ts";
import { JOB_TIMEOUT_MS, jobForCron, type JobName } from "./schedule.ts";

const NEA_PM25 = "https://api-open.data.gov.sg/v2/real-time/api/pm25";
const USER_AGENT = "haze-lah (open-source haze tracker)";
/**
 * Pages loaded after a refresh so the rebuild happens now, not on a visitor. The site's Workers Cache is tiered: one load here fills
 * the upper tier, and every other location is then served from it without rebuilding.
 */
const WARM_PATHS = ["/", "/forecast", "/map", "/photos", "/news", "/glance", "/about", "/api/haze", "/api/replay", "/api/smoke"];

/** Logs one structured line; never pass secrets. */
function log(event: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...extra }));
}

/** Today's NEA PM2.5 items, or null when the request or its JSON fails. */
async function fetchItems(env: Env): Promise<NeaItem[] | null> {
  // At most 4 calls an hour, usually 1 (see the schedule). The key (same as the site's) keeps them off the anonymous limit, which Workers share by IP.
  try {
    const headers = { "User-Agent": USER_AGENT, "x-api-key": env.DATA_GOV_SG_API_KEY };
    const res = await fetch(`${NEA_PM25}?date=${sgtDate(new Date())}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      log("nea-error", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { data?: { items?: NeaItem[] } };
    return body.data?.items ?? [];
  } catch (e) {
    log("nea-error", { error: String(e) });
    return null;
  }
}

/** Loads the main pages one by one; failures are only logged. */
async function warm(env: Env): Promise<void> {
  for (const path of WARM_PATHS) {
    try {
      const res = await fetch(`${env.SITE_URL}${path}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
      await res.arrayBuffer();
      log("warm", { path, status: res.status });
    } catch (e) {
      log("warm-error", { path, error: String(e) });
    }
  }
}

/** Starts one of the site's jobs (`POST /api/jobs/<job>`, same bearer as the refresh) and logs how it went; the site answers with each step's result. */
async function startJob(env: Env, job: JobName): Promise<void> {
  try {
    const res = await fetch(`${env.SITE_URL}/api/jobs/${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.REFRESH_SECRET}`, "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(JOB_TIMEOUT_MS[job]),
    });
    log("job", { job, status: res.status, result: (await res.text()).slice(0, 2000) });
  } catch (e) {
    log("job-error", { job, error: String(e) });
  }
}

/** One check: when NEA's newest reading differs from the last one seen, tell the site to refresh, then warm it and start the hourly jobs. Once this hour's reading is in, the remaining checks of the hour skip NEA. */
async function run(env: Env): Promise<void> {
  const seen = await env.STATE.get("nea");
  if (hasCurrentHour(seen, new Date())) return log("have-hour");
  const items = await fetchItems(env);
  if (!items) return;
  const sig = signature(items);
  if (!sig) return log("no-data");
  if (sig === seen) return log("unchanged", { sig });

  try {
    const res = await fetch(`${env.SITE_URL}/api/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.REFRESH_SECRET}`, "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return log("refresh-failed", { sig, status: res.status });
    log("refreshed", { sig, status: res.status });
  } catch (e) {
    return log("refresh-failed", { sig, error: String(e) });
  }
  await env.STATE.put("nea", sig);
  await warm(env);
  await startJob(env, "hourly");
}

export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(controller, env, ctx) {
    const job = jobForCron(controller.cron);
    ctx.waitUntil(job ? startJob(env, job) : run(env));
  },
} satisfies ExportedHandler<Env>;
