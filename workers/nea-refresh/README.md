# NEA refresh Worker

A Cloudflare Worker (free plan) that keeps the Haze Lah site current and starts its scheduled jobs. On a Cron Trigger it reads NEA's dated PM2.5 feed and compares the newest reading (timestamp and the five 1-hour values) with the last one it saw, kept in KV. Only when that changed does it `POST /api/refresh` on the site (which clears the cache), then loads the main pages and APIs once (`WARM_PATHS`), so they are rebuilt now rather than on a visitor; the site's tiered Workers Cache then serves that copy everywhere. A failed refresh is not saved, so the next run retries. After a successful refresh and warm-up it also starts the hourly jobs.

- Schedules (`src/schedule.ts`, read by `cloudflare.config.ts`; the Worker dispatches on `controller.cron`; all UTC):
  - `2,5,10,20 * * * *`: the NEA check above. NEA posts a new hour about 30 s after the hour (seen 2026-10-25). Once this hour's reading is stored, the remaining checks of the hour read only KV and skip NEA, so NEA is usually called once an hour.
  - `40 * * * *`: `POST /api/jobs/hourly`, a safety net for when the check did not run it. The jobs are idempotent.
  - `30 17 * * *` (01:30 SGT): `POST /api/jobs/history`. `45 17 * * *` (01:45 SGT): `POST /api/jobs/readings`. Both build yesterday and wait up to 10 minutes for the answer.
- The jobs run in the site Worker (`src/lib/jobs/`) and keep their data in its R2 bucket; this Worker only starts them. Each call sends the same bearer as the refresh and the site answers with each step's result, which is logged.
- Binding: KV namespace `STATE` (key `nea`).
- Variable: `SITE_URL` (in `cloudflare.config.ts`).
- Secrets: `REFRESH_SECRET` (required; the same value as on the site Worker) and `DATA_GOV_SG_API_KEY` (the site's data.gov.sg key).
- No public URL (`workersDev: false`). Logs are one JSON line per event (`unchanged`, `refreshed`, `refresh-failed`, `nea-error`, `warm`, `job`, `job-error`).
- The pure logic is in `src/nea.ts` and `src/schedule.ts`; their tests run with the root `npm test`.

## One-time setup

```sh
npm install
npx cf auth login
npx cf kv namespaces create --help   # only if `cf deploy` does not create STATE for you
npx cf deploy
npx wrangler secret put REFRESH_SECRET --name haze-lah-nea-refresh
npx wrangler secret put DATA_GOV_SG_API_KEY --name haze-lah-nea-refresh
```

Set the same `REFRESH_SECRET` on the site Worker. Watch the logs with `npx wrangler tail haze-lah-nea-refresh`.

After changing `cloudflare.config.ts`, run `npm run types` to regenerate `.cloudflare/types` (git-ignored).
