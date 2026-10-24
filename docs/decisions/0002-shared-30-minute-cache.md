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
