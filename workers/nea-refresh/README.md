# NEA refresh Worker

A Cloudflare Worker (free plan) that keeps the Haze Lah site current without Vercel doing any checking. On a Cron Trigger it reads NEA's dated PM2.5 feed and compares the newest reading (timestamp and the five 1-hour values) with the last one it saw, kept in KV. Only when that changed does it `POST /api/refresh` on the site (which clears the cache), then loads the main pages and APIs once (`WARM_PATHS`), so they are rebuilt now rather than on a visitor; the site's tiered Workers Cache then serves that copy everywhere. A failed refresh is not saved, so the next run retries.

- Schedule: minutes 2, 5, 10 and 20 of every hour (UTC; the minutes match Singapore). NEA posts a new hour about 30 s after the hour (seen 2026-10-25). Once this hour's reading is stored, the remaining checks of the hour read only KV and skip NEA, so NEA is usually called once an hour.
- Binding: KV namespace `STATE` (key `nea`).
- Variable: `SITE_URL` (in `cloudflare.config.ts`).
- Secrets: `REFRESH_SECRET` (required; the same value as on the site Worker).
- No public URL (`workersDev: false`). Logs are one JSON line per event (`unchanged`, `refreshed`, `refresh-failed`, `nea-error`, `warm`).
- The pure logic is in `src/nea.ts`; its tests run with the root `npm test`.

## One-time setup

```sh
npm install
npx cf auth login
npx cf kv namespaces create --help   # only if `cf deploy` does not create STATE for you
npx cf deploy
npx wrangler secret put REFRESH_SECRET --name haze-lah-nea-refresh
```

Set the same `REFRESH_SECRET` in Vercel. Watch the logs with `npx wrangler tail haze-lah-nea-refresh`.

After changing `cloudflare.config.ts`, run `npm run types` to regenerate `.cloudflare/types` (git-ignored).
