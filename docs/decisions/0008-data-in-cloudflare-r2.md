# 0008: Keep the site's data in a private R2 bucket, and run the jobs in the Worker

Date: 2026-10. Status: accepted. Replaces [0004](0004-history-in-the-repository.md).

## Context

The history, readings, forecast archive, scores and alert state lived in `data/` of the repository, written by GitHub Actions bots and read through jsDelivr and GitHub's raw host. That meant a bot commit every few hours, a CDN that could serve a stale copy for hours, GitHub's unreliable cron (so an external scheduler was needed), and data that was public by accident of where it was stored.

## Decision

- All data goes in one private Cloudflare R2 bucket, `haze-lah-data`, bound to the site Worker as `DATA`. `src/lib/dataStore.ts` is the only code that touches it. Keys are the old paths without `data/`.
- The scheduled jobs are code in `src/lib/jobs/`, started by `POST /api/jobs/<job>` with the same bearer secret as `/api/refresh`. The Cloudflare Worker in `workers/nea-refresh` calls them: the hourly ones after each NEA refresh (and at :40 as a safety net), the daily history and readings at 01:30 and 01:45 SGT.
- The browser gets only the globe's history files, from this site's own origin (`/data/history/<file>.json`), cached for a year (days) or 5 minutes (index). Nothing else in the bucket is reachable.

Details: [data pipelines](../data-pipelines.md).

## Consequences

- No bot commits, no CDN purge, no third-party hosts for data, and the CSP no longer allows jsDelivr or GitHub's raw host.
- The data is private to the site. The forecast archive and the scores are no longer open for anyone to recompute from the repository.
- The jobs share the Worker's limits (CPU time and subrequests per request). A backfill is limited to 31 days a call for that reason.
- R2 has no append, so the archive step reads a month's file and writes it back whole; runs are minutes apart.
- The history of the repository's `data/` stays in Git until it is removed.
