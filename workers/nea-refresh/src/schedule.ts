/** The Cron Triggers of this Worker and what each starts; a pure module (no Cloudflare imports) so it can be unit-tested and read by `cloudflare.config.ts`. */

/** Minutes 2, 5, 10 and 20 of every hour (UTC; the minutes match Singapore): check NEA and refresh the site. NEA posts a new hour about 30 s after the hour. */
export const CHECK_CRON = "2,5,10,20 * * * *";

/**
 * The site's jobs (`POST /api/jobs/<job>`) by schedule. `hourly` also runs after every refresh; the :40 run is a safety net, and the jobs
 * are idempotent. The daily ones run after the Singapore day is over: history at 01:30 SGT, then readings at 01:45.
 */
export const JOB_CRONS = {
  "40 * * * *": "hourly",
  "30 17 * * *": "history",
  "45 17 * * *": "readings",
} as const;

export type JobName = (typeof JOB_CRONS)[keyof typeof JOB_CRONS];

/** Every schedule the Worker has. */
export const SCHEDULES: string[] = [CHECK_CRON, ...Object.keys(JOB_CRONS)];

/** The job that a firing schedule starts, or null for the NEA check (and any schedule not listed). */
export function jobForCron(cron: string): JobName | null {
  return Object.hasOwn(JOB_CRONS, cron) ? JOB_CRONS[cron as keyof typeof JOB_CRONS] : null;
}

/** How long to wait for a job's answer, in ms. The daily ones read many sources gently (NEA is paused between days). */
export const JOB_TIMEOUT_MS: Record<JobName, number> = { hourly: 5 * 60_000, history: 10 * 60_000, readings: 10 * 60_000 };
