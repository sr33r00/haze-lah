# Haze Lah as a static site on Cloudflare

Date: 2026-10-22. Status: proposed.

## Why

Vercel's free plan pauses the site when server CPU passes 4 hours a month. Each page render costs about 0.25 s of CPU, so the cost grows with traffic and with how often pages refresh. Cloudflare's free Workers allow only 10 ms of CPU a request, so the same server rendering cannot move there as it is.

The fix is to do all the heavy work once, off the hosting platform, and serve finished files. Then visitors cost no server CPU at all, and the site can run free for as long as the free tiers exist, on any host.

## Goals

- Free to run at any traffic, with nothing that can be paused for CPU use.
- Same pages, same look, same data, same 30-minute freshness as now.
- No lock-in: the build output is plain files that any static host can serve.
- If a data source is down, the last good site stays up.

## Non-goals

- No redesign and no new features.
- No database, no user accounts, no server-side personalisation.

## Why it can be static

Every page shows the same thing to every visitor. What is personal (region, group, location, saved settings, theme) already runs in the browser. The server only fetches the public sources, does the maths and renders HTML, and since the last change it does that once every 30 minutes for everyone. A build that runs every 30 minutes produces exactly the same pages, so they can be files.

Only four things need code at request time, and none of them is heavy:

| Route | Why it must stay live | Work per request |
| --- | --- | --- |
| `/api/camera/[id]` | LTA photo links expire after about 5 minutes, and the DataMall key must stay secret | Fetch and pass on one JPEG |
| `/api/cameras` | The camera list changes every minute | Fetch and reshape a small JSON list |
| `/api/webcams` | Windy image links expire | Fetch and reshape a small JSON list |
| `/api/feedback` | Sends email or Telegram with secret keys | One POST |

These become one small Cloudflare Worker. Each request waits on the network but uses well under 10 ms of CPU.

## How it works

```
cron-job.org, every 30 min ──► GitHub Actions "site" workflow
push to main ───────────────►   npm ci
                                 next build (static export, sharp and next/og run here)
                                 check the output (NEA data present)
                                 wrangler deploy ──► Cloudflare: static files + small Worker
```

### 1. Build: GitHub Actions

- A new workflow `.github/workflows/site.yml` runs on push to `main` and on `workflow_dispatch`. cron-job.org calls the dispatch every 30 minutes, as it already does for alerts, because GitHub's own schedule is unreliable.
- GitHub Actions minutes are free and unlimited for public repositories. A build takes about 2 to 3 minutes.
- `concurrency` makes runs queue, not overlap.
- `actions/cache` keeps `.next/cache` between runs, so slow sources (FIRMS, Open-Meteo, the globe pictures) keep their own longer cache lifetimes. This also lowers calls to upstream APIs.
- Keys move from Vercel environment variables to GitHub Actions secrets.

### 2. Static export: Next.js `output: "export"`

The changes:

- **ISR settings:** remove `revalidate` from pages. The 30-minute schedule replaces ISR.
- **Security headers:** move from `next.config.ts` `headers()` to a `public/_headers` file. Cloudflare reads the same CSP and HSTS headers from it.
- **JSON routes become files:** `/api/haze`, `/api/smoke` and `/api/replay` are written at build time. `_headers` gives them the right content type and cache time.
- **Images become files:** `/opengraph-image`, `/twitter-image`, `/alert-card` and `/air-journey` are rendered once per build. `sharp` and `next/og` run in GitHub Actions, where CPU is free.
- **Globe pictures:** `/api/globe/[layer]` and `/series` are built for each layer and day with `generateStaticParams`. The day moves from a query string (`?date=`) into the path (`/api/globe/co/2026-10-21`), and the browser's URL builder in `src/lib/globe.ts` changes to match. Pictures of settled days are reused from the build cache.
- **Rate limits:** to avoid data.gov.sg rate limits (429) during the parallel page build, the data is fetched once per build and shared by all pages. Set `DATA_GOV_SG_API_KEY` as a secret.
- **Local development is unchanged:** `next dev` works as now. The export setting applies only to the production build.

### 3. Hosting: Cloudflare Workers with static assets

- `wrangler.jsonc` serves the `out/` folder as static assets. Static asset requests are free and unlimited, and do not count toward the 100,000 Worker requests a day.
- The Worker in `worker/` handles only the four routes above (`run_worker_first` for `/api/camera*`, `/api/webcams` and `/api/feedback`). It imports the existing fetchers in `src/lib/sources/traffic.ts` and `windy.ts`, so there is no copied code.
- Camera photos are kept in Cloudflare's edge cache for 60 seconds, so many visitors share one LTA fetch.
- Worker secrets (LTA, Windy, Resend, Telegram) are set once with `wrangler secret put`.
- **Failure mode:** if the free 100,000 Worker requests a day ever run out, only camera photos and feedback stop until midnight UTC. The pages, maps and data stay up.

### 4. Analytics: Cloudflare Web Analytics

- Free and cookieless, like Vercel Analytics.
- Remove `@vercel/analytics`, and turn on Web Analytics for the domain in Cloudflare (automatic setup, no code), or add its one script tag.
- Add `static.cloudflareinsights.com` (script) and `cloudflareinsights.com` (connect) to the CSP.
- Past Vercel Analytics numbers stay in Vercel. They do not move.

### 5. Switch-over

1. Deploy to the free `*.workers.dev` address and compare it with the live site at phone and desktop widths, in light and dark. Check every page, the globe, cameras, the share picture and the feedback form.
2. In Cloudflare, attach `www.hazelah.app` to the Worker, and redirect `hazelah.app` to it.
3. Remove the domain from Vercel and disconnect the Git repository, so pushes no longer build there. Keep the Vercel project for two weeks as a fallback, then delete it.
4. Update AGENTS.md (deploys, previews, secrets). The README does not mention deployment, so it does not change.

## What the owner does

- Create a Cloudflare API token with the "Edit Cloudflare Workers" template. Save it and the account ID as GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never paste it into chat.
- Add the app keys as GitHub secrets (same names as `.env.example`).
- Add one cron-job.org job that calls the "site" workflow's dispatch every 30 minutes.
- Approve the switch-over after the preview check.

## Free-tier limits

| Service | Free limit | Our use |
| --- | --- | --- |
| GitHub Actions (public repo) | Unlimited minutes | About 48 builds a day, 2 to 3 min each |
| Cloudflare static assets | Unlimited requests | All pages, data and images |
| Cloudflare Workers | 100,000 requests a day, 10 ms CPU each | Camera photos, lists, feedback |
| Cloudflare Web Analytics | Free | Page views |
| cron-job.org | Free | One job every 30 min |

## Risks

- **Builds that fail:** the previous deploy stays live. The workflow fails visibly in GitHub, and data can only go stale.
- **NEA down during a build:** the check step stops the deploy, so a page without NEA data is never published.
- **Next.js static export gaps:** found during step 2. Each route above has a plan, and anything else falls back to the Worker.
- **GitHub disabling Actions:** scheduled workflows pause after 60 days without repository activity. Ours is started by `workflow_dispatch`, and the data bot commits regularly anyway.

## Order of work

1. Static export builds locally and produces the full `out/` folder (the code work).
2. Worker for the four live routes, tested with `wrangler dev`.
3. GitHub Actions workflow, deploying to `*.workers.dev`.
4. Side-by-side check against the live site.
5. Analytics, switch-over, Vercel shutdown, AGENTS.md.
