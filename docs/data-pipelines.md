# Data pipelines

Scheduled jobs run inside the site Worker and keep the site's own data in a private Cloudflare R2 bucket (`haze-lah-data`, bound as `DATA`). A separate Cloudflare Worker, `workers/nea-refresh`, starts them on a schedule. The repository holds no data and nothing writes to it. There is no database ([ADR 0008](decisions/0008-data-in-cloudflare-r2.md)).

For where the inputs come from, see [data sources](data-sources.md). For the forecast scoring in particular, see [forecast](forecast.md#7-verification).

## Overview

The jobs are code in `src/lib/jobs/`, run by `POST /api/jobs/<job>` (`src/app/api/jobs/[job]/route.ts`). The route accepts the same `Authorization: Bearer <REFRESH_SECRET>` as `/api/refresh` (`src/lib/routeAuth.ts`), answers with each step's result or error as JSON, and gives status 500 if any step failed. Every step logs one JSON line (`job-step`). The only code that touches the bucket is `src/lib/dataStore.ts`.

| Job | Started by (UTC) | Steps | Writes (bucket keys) |
|---|---|---|---|
| `hourly` | After every NEA refresh (`2,5,10,20 * * * *` check), and `40 * * * *` as a safety net | Archive and score forecasts, Telegram alerts, APIMS capture | `archive/YYYY-MM.jsonl`, `forecast-latest.json`, `accuracy.json`, `alert-state.json`, `readings/pending/<date>.json` |
| `history` | `30 17 * * *`: 01:30 SGT daily | Air globe history, then deletes retired versions of the shared page cache | `history/<date>.json`, `history/index.json`; deletes under `runtime-cache/` in the bucket `haze-lah-cache` |
| `readings` | `45 17 * * *`: 01:45 SGT daily | Readings archive | `readings/<date>.json`, `readings/index.json` |

The schedules and the job each starts are in `workers/nea-refresh/src/schedule.ts`. Cloudflare's Cron Triggers are reliable, and every job is idempotent, so a repeated run is harmless: the archive skips an NEA hour it already saved, alerts send once per reading, the capture replaces an hour it already holds.

Each step is its own `try/catch`: a failed archive does not stop the alerts. The hourly job writes each key by reading it and writing it back whole (R2 has no append); runs are minutes apart, so they do not overlap.

## Secrets

Names only, as read by the site Worker (`process.env`); see [AGENTS.md](../AGENTS.md#secrets) for how to set them. Values never go in the repository.

| Secret | Used by | If missing |
|---|---|---|
| `REFRESH_SECRET` | The job routes | The routes answer 503 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `hourly` (alerts) | The alerts step records its state and reports what it would send; `?test=1` fails |
| `FIRMS_MAP_KEY` | `history`, and the live fire counts in `hourly` | `history` stops at once with an error, because every day would have no fires. The archive records no fire counts |
| `DATA_GOV_SG_API_KEY` | `history`, `readings` | Optional. Works anonymously with a lower rate limit |
| `OPENAQ_API_KEY` | `readings` | A note in the result; the community sensors are skipped and each day file says so. The job does not fail |

## Alerts (`hourly`, `src/lib/jobs/alerts.ts`)

Runs after NEA has published the last hour's reading.

1. Read the page data with `getHazeData()` (the same shared build as the pages; not `/api/haze`).
2. `detect` in `src/lib/alerts.ts` compares it with `alert-state.json` and decides what fired: the PSI level changed, the PM2.5 band changed (confirmed by two readings in a row), a new NEA advisory, a new CNA or Straits Times haze story, the 07:00 morning brief (only if today is above PSI 100 in reading or outlook), the 19:00 outlook (only if tomorrow is above 100) and one update per new NEA hourly reading. A field missing from an older state file is recorded without sending. The state holds the last reading, level and stories sent, so a second run for the same reading sends nothing.
3. At most one post goes out: the card image from `/alert-card` plus a short caption (`caption`). Posts between 23:00 and 07:00 are silent (`quietHours`). If the photo fails the caption is sent as text.
4. The new state is written to `alert-state.json`. If Telegram fails the step fails and the state is not saved, so the next run tries again.

`POST /api/jobs/hourly?test=1` runs only this step, sends one test message and leaves the state alone.

## APIMS capture (`hourly`, `captureApims` in `src/lib/jobs/readings.ts`)

APIMS serves only each station's latest hour, so the only way to keep history is to read it every hour. Each run adds the latest hour straight to `readings/pending/<date>.json` (`PendingDay`). An hour captured again replaces itself.

## Archive and score (`hourly`, `src/lib/jobs/archive.ts`)

- The archive step calls `getHazeData`, then appends one line to `archive/YYYY-MM.jsonl`: the forecast as issued, with the last 24 hours of NEA readings and leads 1 to 96. It fails if there are no NEA observations, and does nothing if the month file's last record has the same `issued`. A live forecast is also saved as `forecast-latest.json`, which the pages show when the model is down.
- The score step reads every `.jsonl` file under `archive/` and writes `accuracy.json`. It runs when a new record was archived.

The record format and the scoring are explained in [forecast](forecast.md#7-verification). Only forecast fields, fire counts and error labels are archived; AQICN data is not ([ADR 0005](decisions/0005-no-archive-of-aqicn.md)).

## Air globe history (`history`, `src/lib/jobs/history.ts`)

Daily at 01:30 Singapore time, once the day is over. It writes one file per Singapore day and an index.

**Inputs.** NASA FIRMS fires (`FIRMS_MAP_KEY`), Open-Meteo's CAMS air-quality archive and historical-forecast archive for 850 hPa wind, and NEA's dated feeds. Days are built in chunks of 10 from one pair of Open-Meteo requests to stay under their limits. NEA is read one day at a time with a pause.

**Day file** `history/<date>.json` (`HistoryDay` in `src/lib/historyTypes.ts`, built by `buildDay` in `src/lib/history.ts`):

| Field | Meaning |
|---|---|
| `date` | Singapore date |
| `times` | 8 frames, 3 hours apart, at 00, 03, ... 21 Singapore time (UTC ISO strings) |
| `lats`, `lons` | The 1 degree grid |
| `wind` | `u` and `v` at 850 hPa, m/s, one grid per frame |
| `gases` | CAMS surface concentrations in µg/m³ for each pollutant that has data, one grid per frame |
| `fires` | The strongest fires of the day as `[lat, lon, FRP in MW]`: at most 1500, and fewer if the file would pass 100 KB |
| `totals` | Count of all fires of the day by area (Sumatra, Borneo, peninsula) |
| `trail` | The air that reached Singapore at 2 pm: 72 hours of back-trail, one point an hour |
| `nea` | NEA's highest 24-hour PSI and highest 1-hour PM2.5 of the day, or null |

**Index** `history/index.json` (`HistoryIndex`): `updated` and `days`, a list of `{date, fires, psiMax}` (fires are Sumatra plus Borneo), oldest first.

**Safety checks.** A day with no fires at all in the three areas fails (`assertFires`), because the region always has some and zero means FIRMS has no data yet. A day file is never rewritten by the daily run. The job writes every day it can and lists the days that failed (`failed`), which makes the answer a 500 so the owner sees it. FIRMS's near-real-time product keeps only recent months, so older dates fall back to the standard-processing product and the result's `notes` say so.

**Backfill.** Call the route by hand with `from` and `to` (Singapore dates, `to` must be over; empty `to` means yesterday, empty `from` means the same as `to`), at most 31 days a call:

```sh
curl -X POST -H "Authorization: Bearer $REFRESH_SECRET" "https://hazelah.app/api/jobs/history?from=2026-08-01&to=2026-08-14"
```

`FIRMS_SOURCE` (a Worker variable) forces one FIRMS product. Backfill in chunks of about 2 weeks, one call at a time, and no more than about 3 chunks an hour because of Open-Meteo's limits.

## Readings archive (`readings`, `src/lib/jobs/readings.ts`)

Daily at 01:45 Singapore time, after the history job. It keeps every air reading the site shows, after the live page has moved on. It does not hold cameras or the model data in `history/`.

**Day file** `readings/<date>.json` (`ReadingsDay` in `src/lib/readingsArchive.ts`). Hours are the clock hour (0 to 23, Singapore time) of the timestamp each source gives:

| Field | Meaning |
|---|---|
| `v` | Format version, `1` |
| `date` | Singapore date |
| `nea` | `regions` (north, south, east, west, central), `hours` (the hours served) and 13 series (PSI, 1-hour and 24-hour PM2.5, PM10, O3, CO, SO2, NO2 and the sub-indices; `NEA_SERIES` names each source reading). Each series has one row per hour and one value per region |
| `apims` | Malaysian stations (`stations`) and per station 24 hourly slots of `[api, pm25, pm10, o3, co, so2, no2]`, `null` where not captured |
| `openaq` | Community sensors (`sensors`) and per sensor 24 hourly PM2.5 averages, `null` where none |
| `missing` | Why a source has nothing, or only part, for that day. Never zeros |

**Index** `readings/index.json` (`ReadingsIndex`): `updated` and `days` of `{date, sources, missing}`.

**Pending files** `readings/pending/<date>.json` (`PendingDay`) hold APIMS hours captured by the hourly job that the daily run has not folded in yet. The daily run merges each into its day's file (`foldApims`) and deletes it. A pending file for a day already built is folded in at the end of the run.

**Behaviour.** If NEA fails for a day, that day is not saved and is listed in `failed` (the other days are still written, and the answer is a 500). OpenAQ is read one sensor at a time, 1.1 seconds apart (60 requests a minute is the limit), in 30-day chunks. A day file over 60 KB adds a note. A day takes about 5 seconds, so a call takes up to 31 days. Backfill with the same `from` and `to` parameters as the history job; APIMS cannot be backfilled, because it keeps no history.

The site does not read this archive yet. Only the jobs and tests use `src/lib/readingsArchive.ts`.

## How the browser loads history

`src/lib/historyClient.ts` serves the globe's timeline (`MapScreen`, `HazeOrigin`). The bucket is private; the only files the browser can get are the history ones, through `src/app/data/history/[file]/route.ts`, on this site's own origin.

- **Route.** `GET /data/history/index.json` and `GET /data/history/<YYYY-MM-DD>.json` read `history/<file>` from the bucket. Any other name is a 404. The answer is JSON with `X-Robots-Tag: noindex` and no CORS headers, and `/data/` is disallowed in `robots.txt`.
- **Day files** are sent with `Cache-Control: public, max-age=31536000, immutable`: they never change once written.
- **The index** is sent with `Cache-Control: public, max-age=300`, because it changes daily.
- **Errors.** A `404` means a gap day: it is remembered as missing and not asked for again. A network error, a `5xx` or a `429` is not remembered, so the next call tries again. A body that is not that day's file is rejected.
- **Prefetch.** `prefetchAround` starts loading the next two days so playback does not wait.
- **On the server.** `src/lib/streak.ts` reads `history/index.json` from the bucket to compute the current haze spell. It tops up gaps from NEA live. With no index it starts empty.

The server reads the other keys itself: `fetchAccuracy` reads `accuracy.json` and the saved forecast comes from `forecast-latest.json`. Both come back empty if the bucket cannot be read, and the pages then hide the accuracy table or show no saved forecast.

## Moving data in or out

The bucket is private, so copy files with Wrangler's R2 commands (`npx wrangler r2 object put haze-lah-data/<key> --file <path>`) or the Cloudflare dashboard. Keys are the old paths without the `data/` prefix.
