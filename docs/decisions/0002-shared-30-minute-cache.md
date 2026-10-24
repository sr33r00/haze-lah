# 0002: One shared data build every 30 minutes

Date: 2026-10. Status: accepted.

## Context

Everyone who opens the site sees the same readings. NEA publishes hourly. A page that called a dozen upstream APIs for every visit would be slow, would use up free rate limits (data.gov.sg allows 6 anonymous calls per 10 seconds) and would cost server time for no new information. The site is free and has no ads, so the running cost matters.

## Decision

Build the data once and share it.

- `getHazeData` (`src/lib/data.ts`) wraps the build in `unstable_cache` with `revalidate: 1800`.
- The pages that show live data set `revalidate = 1800`, so Next.js serves a stored page and rebuilds it in the background (`/about` uses 3600).
- The individual fast sources are not cached one by one, because they are read only when the 30-minute build runs.
- The cached build throws when NEA is missing, so a thin result is never kept; `getHazeData` serves a partial build for that request and tries the cache again next time.
- Things that change faster than the page are fetched by the browser instead: the traffic camera list (`/api/cameras`, links expire in about 5 minutes) and the Windy list (`/api/webcams`, 10-minute links), each cached 5 minutes at the CDN.
- Heavier data has its own routes with their own lifetimes: `/api/smoke` and `/api/replay` (upstream changes every 3 hours), `/api/globe/[layer]`.
- `Freshness` asks the app to refresh when a visible tab is over 30 minutes old.

The values are listed in [architecture](../architecture.md#caching-strategy).

## Consequences

- Readings can be up to about 30 minutes behind the source, on top of NEA's own delay. The header says how old the data is.
- The number of upstream calls does not grow with the number of visitors.
- A page render costs no source calls or forecast work.
- Anything new that is fast-changing and visitor-independent should follow the camera pattern (fetched by the browser) rather than being baked into a page.

## Addendum 2026-10-25: refresh on demand

NEA publishes each hour's PM2.5 about 15 minutes past the hour and re-stamps it around 45 minutes past, but the fixed 30-minute clock could show it up to about 40 minutes late. The 30-minute `revalidate` stays as the backstop (a shorter one would cost ISR writes and CPU on the free plan). On top of it, a Cloudflare Worker (`workers/nea-refresh`, free plan) checks NEA's dated PM2.5 feed at :17, :22, :30, :47 and :52 past each hour and compares the newest reading (timestamp and values) with the last one it saw. Only when that changed does it call `POST /api/refresh` (`src/app/api/refresh/route.ts`, `REFRESH_SECRET`), which just revalidates the `haze-data` tag and all pages; the Worker then loads the pages once so the rebuild starts at once. All checking runs on Cloudflare, none on Vercel. `Freshness` now refreshes a visible tab that is over 10 minutes old, at most every 10 minutes.
