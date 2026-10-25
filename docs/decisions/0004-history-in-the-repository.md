# 0004: Keep history in the repository, not a database

Date: 2026-10. Status: replaced by [0008](0008-data-in-cloudflare-r2.md).

## Context

The globe plays any day from 1 August to the forecast, and the readings of past days are worth keeping after the live feeds move on. NEA, Open-Meteo and OpenAQ serve past days; Malaysia's APIMS serves only its latest hour. The site has no accounts and no server-side state, and it is free to run. A database would add a service to pay for, secure and keep alive.

## Decision

Store each Singapore day as a small JSON file in `data/` and let scheduled GitHub Actions jobs commit them.

- `data/history/<date>.json` plus `index.json`: fires, wind, CAMS gases, the 72-hour air trail and NEA's daily peaks (built by `scripts/history.ts`). Day files are kept under about 100 KB.
- `data/readings/<date>.json` plus `index.json`: NEA hourly, APIMS and OpenAQ readings (built by `scripts/readings.ts`), with `pending/` files for the hourly APIMS capture.
- The browser fetches day files from jsDelivr, which serves GitHub content from a CDN. The index comes from GitHub's raw host, because jsDelivr can serve a stale copy of a branch file for hours. If one fails the other stands in.
- A day file is written once and never rewritten by the daily job. A day with no fires at all fails rather than being saved as "clean".

Details: [data pipelines](../data-pipelines.md).

## Consequences

- No database, no server route per visitor, and no cost beyond Git hosting. The history is open and reproducible.
- Git history grows by a few files a day. Files are kept small on purpose.
- The site depends on two third-party hosts for history. Both are allowed in the CSP. A failed load shows a gap, not an error.
- The workflows must run. GitHub's scheduler can skip runs, so each can be started by `workflow_dispatch` and backfilled by hand.
- APIMS history exists only from when capture started; it cannot be backfilled.
- The readings archive is separate from the model history: it holds measurements only. Nothing in the site reads it yet.
