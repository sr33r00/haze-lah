import { sendAlerts } from "./alerts";
import { archiveForecast } from "./archive";
import { cleanCacheVersions } from "./cacheCleanup";
import { buildHistory } from "./history";
import { storeReplay, storeSmoke } from "./latest";
import { sendPollTally } from "./pollTally";
import { buildReadings, captureApims } from "./readings";

// The scheduled jobs of the site Worker. The Cloudflare Worker in `workers/nea-refresh` starts each with `POST /api/jobs/<job>`.

export type JobName = "hourly" | "history" | "readings";

/** A job's steps by name. A step's result is a plain object; one that lists `failed` items counts as failed. */
type Steps = Record<string, () => Promise<object>>;

/** The jobs, each a list of steps. */
const JOBS: Record<JobName, (q: URLSearchParams) => Steps> = {
  /** After each NEA hour (and again as a safety net): archive and score the forecast, send the alerts, keep the latest APIMS hour, tell the owner the poll counts once a day, store the replay and the smoke grid for the API routes. */
  hourly: (q) => {
    const steps: Steps = q.get("test") === "1" ? { alerts: () => sendAlerts(true) } : { archive: archiveForecast, alerts: () => sendAlerts(), readingsCapture: captureApims, pollTally: () => sendPollTally(), replay: storeReplay, smoke: storeSmoke };
    return steps;
  },
  /** Daily: the air globe's history for `from`..`to` (default yesterday, SGT), then the page cache's retired versions deleted. */
  history: (q) => ({ history: () => buildHistory(q.get("from"), q.get("to")), cacheCleanup: cleanCacheVersions }),
  /** Daily: the readings archive for `from`..`to` (default yesterday, SGT). */
  readings: (q) => ({ readings: () => buildReadings(q.get("from"), q.get("to")) }),
};

/** Whether `name` is one of the jobs. */
export const isJob = (name: string): name is JobName => Object.hasOwn(JOBS, name);

/** How one step ended: its result, or the error that stopped it. */
export type StepOutcome = { ok: true; result: object } | { ok: false; error: string; result?: object };

/** Runs one step; its failure is caught so the steps after it still run. Logs one line (never a secret: results hold counts and dates). */
async function runStep(job: string, step: string, fn: () => Promise<object>): Promise<StepOutcome> {
  const started = Date.now();
  let outcome: StepOutcome;
  try {
    const result = await fn();
    const failed = (result as { failed?: string[] }).failed;
    outcome = failed?.length ? { ok: false, error: `${failed.length} failed`, result } : { ok: true, result };
  } catch (e) {
    outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  console.log(JSON.stringify({ event: "job-step", job, step, ms: Date.now() - started, ...outcome }));
  return outcome;
}

/** Runs the steps of `job` one after the other. `ok` is false when any step failed. */
export async function runJob(job: JobName, query: URLSearchParams): Promise<{ ok: boolean; steps: Record<string, StepOutcome> }> {
  const steps: Record<string, StepOutcome> = {};
  for (const [step, fn] of Object.entries(JOBS[job](query))) steps[step] = await runStep(job, step, fn);
  return { ok: Object.values(steps).every((s) => s.ok), steps };
}
