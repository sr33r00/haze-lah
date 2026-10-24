# Data pipelines

Four GitHub Actions workflows in `.github/workflows/` run scripts from `scripts/` on a schedule. Three of them commit their output to `data/` in this repository. The site then reads those files over the network. There is no database ([ADR 0004](decisions/0004-history-in-the-repository.md)).

For where the inputs come from, see [data sources](data-sources.md). For the forecast scoring in particular, see [forecast](forecast.md#7-verification).

## Overview

| Workflow | File | Schedule (UTC, and Singapore time) | Script | Writes |
|---|---|---|---|---|
| Telegram alerts | `alerts.yml` | `10 * * * *`: hourly at :10 | `scripts/alert.ts`, then `scripts/readings.ts --capture` | `data/alert-state.json`, `data/readings/pending/<date>.json` |
| Archive and score forecasts | `archive.yml` | `7 * * * *`: hourly at :07 | `scripts/archive.ts`, then `scripts/score.ts` | `data/archive/YYYY-MM.jsonl`, `data/accuracy.json` |
| Air globe history | `history.yml` | `30 17 * * *`: 01:30 SGT daily | `scripts/history.ts` | `data/history/<date>.json`, `data/history/index.json` |
| Readings archive | `readings.yml` | `45 17 * * *`: 01:45 SGT daily | `scripts/readings.ts` | `data/readings/<date>.json`, `data/readings/index.json` |

All four also have `workflow_dispatch`, so they can be started by hand or by a call to GitHub's "create a workflow dispatch event" API.

**GitHub's cron is not reliable.** Scheduled runs can be delayed or skipped. Because every workflow accepts `workflow_dispatch`, an external scheduler can trigger them on time. The hourly alert job and the two daily jobs can all be triggered this way. Each workflow has a `concurrency` group with `cancel-in-progress: false`, so a late run queues instead of cancelling the one before it (GitHub keeps only one pending run per group).

Each job checks out the repository, sets up Node 22, runs `npm ci --ignore-scripts`, runs its script, then commits what changed as the bot user, runs `git pull --rebase` and pushes. Commit messages start with `data:`. Because bots commit to `main` every few hours, pull before you commit your own work.

## Secrets

Names only, as read by the workflows. Each is a repository secret; values never go in the repository.

| Secret | Used by | If missing |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `alerts.yml` | `scripts/alert.ts` prints what it would send and sends nothing. `ALERT_TEST` mode throws |
| `FIRMS_MAP_KEY` | `archive.yml`, `history.yml` | `history.yml` stops at once with an error, because every day would have no fires. `archive.yml` records no fire counts |
| `DATA_GOV_SG_API_KEY` | `archive.yml`, `history.yml`, `readings.yml` | Optional. Works anonymously with a lower rate limit |
| `OPENAQ_API_KEY` | `readings.yml` | A warning; the community sensors are skipped and each day file says so. The job does not fail |

All four workflows have `contents: write` permission so they can push.

## Alerts (`alerts.yml`, `scripts/alert.ts`)

Every hour at :10, after NEA has published the last hour's reading.

1. Fetch `${SITE_URL}/api/haze` (`HAZE_JSON_URL` overrides it). The job reads the live site's data and does not build its own.
2. `detect` in `src/lib/alerts.ts` compares it with `data/alert-state.json` and decides what fired: the PSI level changed, the PM2.5 band changed (confirmed by two readings in a row), a new NEA advisory, a new CNA or Straits Times haze story, the 07:00 morning brief (only if today is above PSI 100 in reading or outlook), the 19:00 outlook (only if tomorrow is above 100) and one update per new NEA hourly reading. A field missing from an older state file is recorded without sending.
3. At most one post goes out: the card image from `/alert-card` plus a short caption (`caption`). Posts between 23:00 and 07:00 are silent (`quietHours`). If the photo fails the caption is sent as text.
4. The new state is written to `data/alert-state.json` and committed.

`workflow_dispatch` has a `test_alert` option that sends one test message and leaves the state alone.

The same job then captures Malaysian APIMS readings. APIMS serves only each station's latest hour, so the only way to keep history is to read it every hour:

1. The buffer folder `.readings-cache` is restored from the Actions cache.
2. `scripts/readings.ts --capture` appends the latest APIMS hour to the buffer.
3. About every 6 hours (`FLUSH_EVERY_MS`) it copies the buffer to `data/readings/pending/<date>.json` and sets `flush=true`; only then does the workflow commit that folder, so commits stay few.
4. This step has `continue-on-error`, so a failure never blocks the alerts or their commit.

## Archive and score (`archive.yml`)

Hourly at :07.

- `scripts/archive.ts` calls `getHazeData`, then appends one line to `data/archive/YYYY-MM.jsonl`: the forecast as issued, with the last 24 hours of NEA readings and leads 1 to 96. It exits with an error if there are no NEA observations.
- `scripts/score.ts` reads every `.jsonl` file in `data/archive/` and writes `data/accuracy.json`.

The record format and the scoring are explained in [forecast](forecast.md#7-verification). Only forecast fields, fire counts and error labels are archived; AQICN data is not ([ADR 0005](decisions/0005-no-archive-of-aqicn.md)).

## Air globe history (`history.yml`, `scripts/history.ts`)

Daily at 01:30 Singapore time, once the day is over. It writes one file per Singapore day and an index.

**Inputs.** NASA FIRMS fires (`FIRMS_MAP_KEY`), Open-Meteo's CAMS air-quality archive and historical-forecast archive for 850 hPa wind, and NEA's dated feeds. Days are built in chunks of 10 from one pair of Open-Meteo requests to stay under their limits. NEA is read one day at a time with a pause.

**Day file** `data/history/<date>.json` (`HistoryDay` in `src/lib/historyTypes.ts`, built by `buildDay` in `src/lib/history.ts`):

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

**Index** `data/history/index.json` (`HistoryIndex`): `updated` and `days`, a list of `{date, fires, psiMax}` (fires are Sumatra plus Borneo), oldest first.

**Safety checks.** A day with no fires at all in the three areas fails (`assertFires`), because the region always has some and zero means FIRMS has no data yet. A day file is never rewritten by the daily run. The script writes every day it can, exits non-zero if any failed, and the workflow commits what was written and then fails the job so the owner sees it. FIRMS's near-real-time product keeps only recent months, so older dates fall back to the standard-processing product and the log says so.

**CDN purge.** After the commit the workflow asks jsDelivr to drop its copy of the index and each day built, then checks the CDN's index has the new `updated` value and purges again (up to 8 times) if not.

**Backfill.** Run the workflow by hand with `from` and `to` (Singapore dates, `to` must be over; empty `to` means yesterday, empty `from` means the same as `to`), and optionally `firms_source` to force one FIRMS product. Backfill in chunks of about 2 weeks, one run at a time, and no more than about 3 chunks an hour because of Open-Meteo's limits. Locally: `npx tsx scripts/history.ts --from 2026-08-01 --to 2026-08-14` (needs `FIRMS_MAP_KEY`).

## Readings archive (`readings.yml`, `scripts/readings.ts`)

Daily at 01:45 Singapore time, after the history job. It keeps every air reading the site shows, after the live page has moved on. It does not hold cameras or the model data in `data/history`.

**Day file** `data/readings/<date>.json` (`ReadingsDay` in `src/lib/readingsArchive.ts`). Hours are the clock hour (0 to 23, Singapore time) of the timestamp each source gives:

| Field | Meaning |
|---|---|
| `v` | Format version, `1` |
| `date` | Singapore date |
| `nea` | `regions` (north, south, east, west, central), `hours` (the hours served) and 13 series (PSI, 1-hour and 24-hour PM2.5, PM10, O3, CO, SO2, NO2 and the sub-indices; `NEA_SERIES` names each source reading). Each series has one row per hour and one value per region |
| `apims` | Malaysian stations (`stations`) and per station 24 hourly slots of `[api, pm25, pm10, o3, co, so2, no2]`, `null` where not captured |
| `openaq` | Community sensors (`sensors`) and per sensor 24 hourly PM2.5 averages, `null` where none |
| `missing` | Why a source has nothing, or only part, for that day. Never zeros |

**Index** `data/readings/index.json` (`ReadingsIndex`): `updated` and `days` of `{date, sources, missing}`.

**Pending files** `data/readings/pending/<date>.json` (`PendingDay`) hold APIMS hours captured by `alerts.yml` that the daily run has not folded in yet. The daily run merges each into its day's file (`foldApims`) and deletes it. A pending file for a day already built is folded in at the end of the run.

**Behaviour.** If NEA fails for a day, that day is not saved and the exit code is non-zero (the workflow still commits what was written, then fails). OpenAQ is read one sensor at a time, 1.1 seconds apart (60 requests a minute is the limit), in 30-day chunks. A day file over 60 KB prints a warning. A day takes about 5 seconds, so a month or two fits one run. Backfill with the same `from` and `to` inputs as the history job; APIMS cannot be backfilled, because it keeps no history. The workflow purges the CDN copy of the index and each day like the history job.

The site does not read this archive yet. Only the scripts and tests use `src/lib/readingsArchive.ts`.

## How the browser loads history

`src/lib/historyClient.ts` serves the globe's timeline (`MapScreen`, `HazeOrigin`) without any server route.

- **Day files** come from jsDelivr (`cdn.jsdelivr.net/gh/...@main/data/history/<date>.json`). They never change once written, so the browser's normal cache applies.
- **The index** comes from GitHub's raw host, revalidated each time (`cache: "no-cache"`), because jsDelivr can serve an old copy of a branch file for hours even after a purge. If the raw host does not answer (some content blockers stop it), the jsDelivr copy stands in.
- **Errors.** A `404` means a gap day: it is remembered as missing and not asked for again. A network error, a `5xx` or a `429` is not remembered, so the next call tries again. A body that is not that day's file is rejected.
- **Prefetch.** `prefetchAround` starts loading the next two days so playback does not wait.
- **Build-time copy.** `src/lib/streak.ts` also imports the committed `data/history/index.json` when the site is built, to compute the current haze spell without a request. It tops up gaps from NEA live.

Both hosts are allowed in `connect-src` in `next.config.ts`.

Forecast accuracy is read differently: the server fetches `data/accuracy.json` from GitHub's raw host (`fetchAccuracy`, one hour).
