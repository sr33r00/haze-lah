# Air globe /map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/map` with a full-screen premium air globe (season timeline from 1 Aug 2026, measured-reading dots, eight colour layers), save daily history in the repo, and move the smoke map's features into Now's "Where today's air came from" map.

**Architecture:** The throwaway spike (`src/components/spike/`, `/spike-globe`) becomes real components under `src/components/globe/`, driven by pure, tested helpers in `src/lib/`. Today and the forecast come from the existing live routes (`/api/replay`, `/api/smoke`, extended with gases); past days come from `data/history/*.json` in the repo, written by a GitHub Actions job and served to browsers by jsDelivr. No new per-visitor server work.

**Tech Stack:** Next.js 15 App Router, TypeScript, MapLibre GL 5 (globe projection), Tailwind 4, NASA GIBS, NASA FIRMS, Open-Meteo (CAMS, ECMWF), data.gov.sg, GitHub Actions, jsDelivr. Tests: Node's built-in runner through tsx (`npx tsx --test`), no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-23-air-globe-map-design.md` (read it first; its "Decisions after review" section is binding).

## Global Constraints

- Follow AGENTS.md: DRY strictly (grep before adding a helper or string), no emojis, 44 px targets, `aria-pressed` on toggles, labels on icon buttons, `aria-live` on changing captions, reduced motion respected, light and dark site themes work (the globe itself is always dark).
- Look as approved: Black Marble + dimmed Blue Marble, atmosphere glow; country borders bright and solid (`rgba(235,242,255,0.85)`, width 1.3 scaling with zoom), coasts `0.45`, province lines `0.14`; fires red to orange to yellow; new zones cyan `#5fe3ee`; path purple `TRAIL_COLOR`; smoke on the way dashed amber `#fbbf77`; wind faint white streaks.
- Pollutant ramp: the "smoke" stops from the spike (`src/components/spike/spikeField.ts`, `PM_STOPS`/`PM_ALPHA`), keyed to four bands per pollutant; Normal nearly invisible.
- New fire zones use `newFires` in `src/lib/replay.ts` (50 km rule, one ring per 30 km) everywhere.
- No new per-visitor server routes. History is fetched from `https://cdn.jsdelivr.net/gh/sr33r00/haze-lah@main/data/history/`.
- Every health or science number cites its source in a code comment (NEA PSI table, WHO 2021).
- Commits: `git -c user.name="Sr33" -c user.email="69857377+sr33r00@users.noreply.github.com" commit`, no trailers. Never push or deploy; the owner says when.
- Before each commit: `npx tsc --noEmit`, `npm run lint`, and the task's tests. Never run prettier.

## Review Focus

1. History not there yet (index 404, jsDelivr down, CSP block): the globe must still work with the live last 5 days, and the timeline shows only the days it has. Test in Task 6.
2. Newest FIRMS day empty right after UTC midnight: the fire layer and headline use the latest day with at least 20 fires, and say which date. Test in Task 4.
3. A gas missing or all-null in the CAMS answer: its layer button is disabled with "Not available now"; PM2.5 still works. Test in Task 3.
4. A day file missing in the middle of the history (a failed daily job): the bar shows as a gap, scrubbing skips it, nothing throws. Test in Task 6.
5. WebGL unavailable or MapLibre fails to load: a plain message plus the visually hidden summary as visible text. Test in Task 8 (render check).

---

### Task 1: Baseline: commit the Now-map work and set up tests

The working tree already holds the Now-map changes (wind streaks, day marks, new zones, forward smoke path) and a CSP change for GIBS. Make them a clean commit with tests for the pure helpers.

**Files:**
- Modify: `package.json` (add script `"test": "tsx --test src/**/*.test.ts"`; check the glob works in the npm shell, else list files explicitly)
- Create: `src/lib/replay.test.ts`
- Commit with: `src/components/HazeOrigin.tsx`, `src/lib/replay.ts`, `src/lib/types.ts`, `next.config.ts`

**Interfaces:**
- Produces: `npm test`; `newFires(days: ReplayDay[]): [number, number][]`, `windAtSg(grid, wind): { from: string; kmh: number } | null` (exist).

- [ ] **Step 1: Write tests** in `src/lib/replay.test.ts` with `node:test` and `node:assert/strict`:
  - `newFires returns [] without earlier days`
  - `newFires ignores a fire within 50 km of an earlier fire` (earlier `[0,110]`, today `[0.3,110]` → `[]`)
  - `newFires keeps one ring per 30 km` (today `[3,100]`, `[3.1,100]`, earlier far away → length 1)
  - `windAtSg turns u=-5,v=5 m/s into a south-east wind of 25 km/h` (grid lats `[0,2]`, lons `[103,104]`, all four cells the same)
- [ ] **Step 2: Run** `npm test` → PASS (helpers exist).
- [ ] **Step 3: Commit** (keep the CSP `connect-src https://gibs.earthdata.nasa.gov`; the globe needs it) `Now map: wind, day marks, new fire zones, where smoke goes next; test runner`.

### Task 2: Pollutant registry and colours

**Files:**
- Create: `src/lib/pollutants.ts`, `src/lib/pollutants.test.ts`

**Interfaces:**
- Produces:
  - `type PollutantId = "pm25" | "pm10" | "co" | "no2" | "so2" | "o3" | "dust"`
  - `type Pollutant = { id: PollutantId; label: string; unit: string; camsVar: string; bands: [number, number, number] | null; source: string }` where `bands` are the upper limits of bands 0 to 2 (band 3 above), in the CAMS unit; `null` for dust (plain low/high legend, ramp 0 to 500).
  - `POLLUTANTS: Pollutant[]` in picker order: PM2.5, PM10, CO, NO₂, SO₂, O₃, Dust.
  - `bandOf(p: Pollutant, v: number): 0 | 1 | 2 | 3`
  - `colorOf(p: Pollutant, v: number): [r: number, g: number, b: number, a: number]` (a in 0..1)
  - `rampCss(p: Pollutant): string` (CSS gradient for the legend)
  - `BAND_NAMES = ["Normal", "Elevated", "High", "Very high"]` for PM2.5 (reuse `PM25_BANDS` names), and for others the PSI words from `LEVEL_NAME` mapped per band; pick one source, do not duplicate strings.
- Values: PM2.5 bands `[55, 150, 250]` from `PM25_BANDS`. PM10, CO, SO₂, O₃ from NEA's PSI breakpoint table at sub-index 50/100/200 (verify each against NEA's published "Computation of the PSI" table and put its URL in the comment; CAMS CO is µg/m³, so convert mg/m³ × 1000). NO₂: `[25, 200, 1130]` (WHO 2021 24-h guideline, WHO 1-h guideline, NEA PSI 200 level); cite each. Colour stops and alpha: move `PM_STOPS`/`PM_ALPHA` from the spike, re-expressed on band position (0 = clean, 1 = band 0 limit, 2 = band 1 limit, 3 = band 2 limit, 4 = twice band 2), so every pollutant uses one ramp.

- [ ] **Step 1: Write failing tests:** `pm25 at 30 is band 0 and alpha below 0.2`; `pm25 at 200 is band 2 and alpha above 0.6`; `pm25 below 20 is fully transparent`; `co uses µg/m³ (6000 is band 1)`; `dust has no bands and colorOf(dust, 400).a > 0.5`; `every POLLUTANTS id is unique and has a source`.
- [ ] **Step 2: Run** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/pollutants.ts`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `Pollutants: bands and smoke colours for PM2.5, PM10, CO, NO2, SO2, O3, dust`.

### Task 3: All CAMS gases on the live grid

**Files:**
- Modify: `src/lib/sources/openmeteo.ts` (`fetchSmokeGrid`), `src/lib/types.ts` (`SmokeGrid`), `src/lib/mock.ts` (`mockGrid`)
- Create: `src/lib/sources/openmeteo.test.ts`

**Interfaces:**
- Consumes: `POLLUTANTS`, `PollutantId` (Task 2).
- Produces: `SmokeGrid` gains `gases: Partial<Record<Exclude<PollutantId, "pm25">, number[][]>>` (same shape as `values`, which stays PM2.5 for existing users). A gas whose values are all null is left out. Pure helper `gridFrames(aq: AQ[], idx: number[], v: string): number[][] | null` used for PM2.5 and every gas.

- [ ] **Step 1: Write failing tests** with a 2-point fixture of the Open-Meteo air-quality JSON: `gridFrames picks the 3-hourly indexes`, `gridFrames returns null when every value is null`, `missing gas leaves gases without that key` (Review Focus 3).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** one request with `hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust` (the `camsVar`s), same cache (`revalidate: 10800`). Round values to integers before returning (keeps `/api/smoke` small). Update `mockGrid`.
- [ ] **Step 4: Run** tests, `npx tsc --noEmit`; then `curl -s localhost:<port>/api/smoke | head -c 300` on a dev server shows `gases`. Check the response size stays under about 250 KB; if not, drop to the first 9 frames (24 h) for gases only and note it.
- [ ] **Step 5: Commit** `Smoke grid: PM10, CO, NO2, SO2, ozone and dust from the same CAMS request`.

### Task 4: History day files: format, builder and script

**Files:**
- Create: `src/lib/history.ts`, `src/lib/history.test.ts`, `scripts/history.ts`
- Modify: `src/lib/sources/firms.ts` (add a dated range fetch), `src/lib/sources/openmeteo.ts` (historical wind and air quality for a date), `src/lib/sources/nea.ts` (daily figures for a date, reusing the `fetchPsiDaily` request)

**Interfaces:**
- Consumes: `POLLUTANTS` (Task 2), `backTrail` from `src/lib/wind.ts`, `classify` from firms.ts, area naming from replay.ts.
- Produces:
  - `type HistoryDay = { date: string; fires: [lat: number, lon: number, frp: number][]; totals: Record<"sumatra" | "borneo" | "peninsula", number>; times: string[]; lats: number[]; lons: number[]; wind: { u: number[][]; v: number[][] }; gases: Partial<Record<PollutantId, number[][]>>; trail: [number, number][]; nea: { psiMax: number | null; pm25Max: number | null } }` (3-hourly frames, 8 per day, SGT day).
  - `type HistoryIndex = { updated: string; days: { date: string; fires: number; psiMax: number | null }[] }`
  - `buildDay(input: { date: string; fires: Fire[]; frames: WindFrame[]; aq: { times: string[]; lats: number[]; lons: number[]; values: Partial<Record<PollutantId, number[][]>> }; nea: HistoryDay["nea"] }): HistoryDay` (pure; rounds lat/lon to 2 dp, FRP to integer, gases and wind to integers or 1 dp; keeps the 1,500 strongest fires; totals count all).
  - `addToIndex(index: HistoryIndex, day: HistoryDay): HistoryIndex` (replaces a same-date entry, keeps dates sorted).
  - `latestFireDay<T extends { fires: unknown[] }>(days: T[], min = 20): T | undefined` (Review Focus 2; also used by the globe).
  - Script: `npx tsx scripts/history.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]`, default yesterday (SGT). Writes `data/history/<date>.json` and `data/history/index.json`. Exits non-zero if any day fails, after writing the others.
- FIRMS: area API, 5 days per request, `FIRMS_MAP_KEY` from env. Use one product for all history: first try `VIIRS_NOAA20_NRT`/`VIIRS_SNPP_NRT` as the live code does for 1 Aug 2026; if FIRMS has moved that date to standard processing, use the `_SP` product for the whole history and say so in the script's header comment.
- Open-Meteo: air quality with `start_date`/`end_date` and `domains=cams_global`; wind from the historical-forecast API at 850 hPa, the same grid as `gridQuery()`.

- [ ] **Step 1: Write failing tests:** `buildDay keeps at most 1500 fires but totals count all`; `buildDay rounds lat/lon to 2 decimals`; `buildDay output for one day is under 100 KB of JSON` (fixture: full grid, 8 frames, 1,500 fires); `addToIndex replaces the same date and keeps order`; `latestFireDay skips a day with 3 fires` (Review Focus 2).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/lib/history.ts` and the source helpers. **Step 4: Run** → PASS.
- [ ] **Step 5: Try the script locally for one day without FIRMS** (`--from 2026-10-20 --to 2026-10-20`; no key, so fires empty and a warning): file written, under 100 KB, valid JSON. Delete that test file afterwards; do not commit generated data from a run without fires.
- [ ] **Step 6: Commit** `History: daily files for the globe (format, builder, script)`.

### Task 5: History workflow (backfill and daily)

**Files:**
- Create: `.github/workflows/history.yml`
- Modify: `AGENTS.md` (one line under "Where things are" and a line on the cron-job.org trigger)

**Interfaces:**
- Consumes: `scripts/history.ts` (Task 4).

- [ ] **Step 1: Write the workflow:** triggers `schedule: "30 17 * * *"` (01:30 SGT) and `workflow_dispatch` with optional inputs `from`, `to`. Steps as in `archive.yml` (pinned actions, `npm ci --ignore-scripts`, `FIRMS_MAP_KEY` and `DATA_GOV_SG_API_KEY` secrets), run the script, commit `data/history` as `haze-lah-bot` with message `data: history <from>..<to>`, `git pull --rebase --quiet && git push`, then purge `https://purge.jsdelivr.net/gh/sr33r00/haze-lah@main/data/history/index.json` with `curl -fsS` (failure only warns). `concurrency: history`. `timeout-minutes: 30`.
- [ ] **Step 2: Validate** with `npx -y @action-validator/cli .github/workflows/history.yml` if available, else check YAML parses (`node -e "require('yaml')"` is not a dependency, so use `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" .github/workflows/history.yml`).
- [ ] **Step 3: Commit** `History workflow: daily file at 01:30 SGT and a manual backfill`. The backfill itself (`from 2026-08-01`) is run by the owner from GitHub's Actions tab after the push; say so in the final report.

### Task 6: History in the browser

**Files:**
- Create: `src/lib/historyClient.ts`, `src/lib/historyClient.test.ts`
- Modify: `next.config.ts` (CSP `connect-src` adds `https://cdn.jsdelivr.net`)

**Interfaces:**
- Consumes: `HistoryDay`, `HistoryIndex` (Task 4).
- Produces: `HISTORY_BASE = "https://cdn.jsdelivr.net/gh/sr33r00/haze-lah@main/data/history/"`; `historyUrl(date: string): string`; `loadIndex(fetchFn = fetch): Promise<HistoryIndex | null>` (null on any failure, never throws: Review Focus 1); `loadDay(date: string, fetchFn = fetch): Promise<HistoryDay | null>` (memoised per date; null on 404: Review Focus 4); `prefetchAround(date: string, dates: string[])` loads the next 2 dates.

- [ ] **Step 1: Write failing tests** with a fake `fetchFn`: `loadIndex returns null when fetch rejects`; `loadIndex returns null on 404`; `loadDay memoises (fetch called once for two calls)`; `loadDay returns null for a missing day`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `History client: index and day files from jsDelivr`.

### Task 7: Timeline model

**Files:**
- Create: `src/lib/timeline.ts`, `src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `HistoryIndex` (Task 4), `Replay` (`src/lib/types.ts`), `SmokeGrid` (Task 3), `DayPsi[]` (`data.psiDaily`).
- Produces:
  - `type Bar = { date: string; kind: "past" | "today" | "forecast"; fires: number | null; source: "history" | "live" | "none" }`
  - `buildBars(index: HistoryIndex | null, replay: Replay, smoke: SmokeGrid, today: string): Bar[]` (history dates first, live replay days override history for the same date, then forecast dates from `smoke.times` after today with `fires: null`; missing dates between 1 Aug and today appear with `source: "none"`).
  - `type Mark = { date: string; label: string }`; `eventMarks(index: HistoryIndex | null, psiDaily: DayPsi[]): Mark[]` (first date PSI > 100 → "PSI above 100", first > 200 → "PSI above 200").
  - `stepsOf(bar: Bar, smoke: SmokeGrid): string[]` (ISO times of the 3-hour steps available for that day; empty for past days without history).

- [ ] **Step 1: Write failing tests:** `bars run from the first history date to the last forecast date with no duplicates`; `live replay overrides history for the same date`; `a missing middle day is source none` (Review Focus 4); `forecast bars have fires null`; `eventMarks finds the first PSI above 100 and 200`; `with no index, bars start at the first replay day` (Review Focus 1).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Timeline: days from 1 Aug to the forecast, with PSI marks`.

### Task 8: The globe components

Fold the spike into real components. Delete the spike at the end of this task.

**Files:**
- Create: `src/components/globe/AirGlobe.tsx` (MapLibre map, layers, camera; loaded with `next/dynamic`, `ssr: false`), `src/components/globe/globeStyle.ts` (from `spikeStyle.ts`), `src/components/globe/fieldImage.ts` (from `spikeField.ts`, now using `colorOf` from Task 2 and taking any pollutant), `src/components/globe/frame.ts` (pure: GeoJSON for fires, old fires, new zones, trail with day dots, ahead path, from a selected day; from `spikeData.ts`), `src/components/globe/frame.test.ts`
- Delete: `src/components/spike/`, `src/app/spike-globe/`

**Interfaces:**
- Consumes: Tasks 2, 3, 6, 7; `globeView` and `useWindParticles` (existing); `newFires`, `latestFireDay`.
- Produces:
  - `type GlobeDay = { date: string; kind: Bar["kind"]; fires: [number, number, number][]; older: [number, number][]; fresh: [number, number][]; trail: [number, number][]; ahead: [number, number][]; grid: { lats: number[]; lons: number[] }; wind: { u: number[]; v: number[] } | null; field: number[] | null }` (one 3-hour step).
  - `globeDay(source: { history?: HistoryDay; replay?: Replay; smoke?: SmokeGrid }, date: string, step: number, layer: PollutantId | "smoke" | "off"): GlobeDay` in `frame.ts`. Forecast days: today's fires dimmed into `older`, `fresh` empty, `trail` from forecast wind via `backTrail` (spec decision).
  - `AirGlobe` props: `{ day: GlobeDay; layer: PollutantId | "smoke" | "off"; satDate: string; view: "default" | "path"; onFail?: () => void }` (Task 9 adds `dots`).
  - Satellite "smoke" layer: the existing `/api/globe/smoke` texture when `satDate` is within the last 8 days (`globeDates()`), else GIBS WMTS tiles for that date direct from NASA (OMPS aerosol index layer; find the exact GIBS layer id and URL template with GetCapabilities and pin it in a comment). CO: same rule with the AIRS CO layer.
  - WebGL failure: catch MapLibre's error event / constructor throw and call an `onFail` prop (Review Focus 5).

- [ ] **Step 1: Write failing tests** for `globeDay`: `past day from history uses its fires and trail`; `forecast day has no fresh rings and dims today's fires`; `layer off gives field null`; `uses latestFireDay when today's live day has under 20 fires`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `frame.ts`, then the components, moving code from the spike (keep its visual choices; borders as in Global Constraints).
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 5: Commit** `Globe: real components from the test build, for any day and pollutant`.

### Task 9: Measured-reading dots

**Files:**
- Create: `src/lib/readings.ts`, `src/lib/readings.test.ts`

**Interfaces:**
- Consumes: `HazeData` (`nea`, `stations`, `sensors`, Indonesian city model points as already in `stations` with `country === "ID"`; check how they are marked), `bandOf` (Task 2), `REGION_POINT`.
- Produces: `type Dot = { lat: number; lon: number; label: string; value: string; band: 0 | 1 | 2 | 3 | null; kind: "measured" | "model" }`; `readingDots(data: HazeData, layer: PollutantId | "smoke" | "off", isToday: boolean): Dot[]`.
- Rules (spec): only when `isToday`; NEA regions show the chosen pollutant (PM2.5 1-h concentration; for PM10, O₃, CO, SO₂ the PSI sub-index, band from PSI 50/100/200; NO₂ from `no2_1h_max` concentration); Malaysian stations and sensors show PM2.5 (or API for Malaysia when PM2.5 is null) with "PM2.5"/"API" in the label; Indonesian cities `kind: "model"`; on `dust`, `smoke` and `off` all dots hide.

- [ ] **Step 1: Write failing tests:** `no dots on a past day`; `no dots on dust`; `NEA central shows the O3 sub-index on the O3 layer`; `a Malaysian station shows PM2.5 on the CO layer, labelled PM2.5`; `Indonesian city is kind model`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; add a `dots: Dot[]` prop to `AirGlobe` and draw them as a circle layer (measured: filled; model: hollow) with a tap/hover popup showing `label` and `value`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Globe: measured readings as dots`.

### Task 10: The /map page

**Files:**
- Modify: `src/app/map/page.tsx` (full-screen globe page; metadata text updated to the globe)
- Create: `src/components/globe/MapScreen.tsx` (client: state for layer, selected bar, step, play; loads index/day; renders `AirGlobe`, top bar, bottom card, timeline), `src/components/globe/Timeline.tsx`, `src/components/globe/GlobeCard.tsx` (headline, facts, legend, key, attribution)
- Delete: `src/components/MapView.tsx`, `src/components/SpaceView.tsx`, `src/components/FireTrend.tsx`, `src/components/WindDial.tsx` (only if grep shows no other users), and any helpers left unused (grep)
- Modify: `src/lib/releases.ts` and every link to `/map#space` (grep `#space`) → `/map`; "See it on the map" in `HazeOrigin.tsx` → `/map?view=path`

**Interfaces:**
- Consumes: Tasks 6 to 9; `getHazeData()` on the server for today's data and the hidden summary.
- Produces: page at `/map` with `?view=path` support.

Behaviour (from the spec):
- Full screen (`100dvh`), no site header or bottom nav over the globe: render the page without `AppShell` chrome (keep `WhatsNew` out), but keep a skip link and the back link to `/`.
- Top bar: back link; layer picker in `POLLUTANTS` order plus "Smoke" (satellite) and "Off"; scrolls horizontally on a phone; disabled entries for gases missing from `smoke.gases` with "Not available now" (Review Focus 3).
- Bottom card: collapsed it covers at most a third of the phone screen; drag or a button expands it. Headline built from the selected day (reuse `journeyText`/`trailCaption`/Smoke on the way wording from `src/lib/replay.ts`; do not write new variants of the same sentences). Facts line, legend (`rampCss`, band names), key (fire, new zone, path, smoke on the way, measured dot, model dot), attribution.
- Timeline: bars from `buildBars`, hatched forecast, marks from `eventMarks`, today marked, drag to scrub across the whole strip, play steps day by day (3-hour steps within today and forecast), newest ~90 days visible with horizontal scroll back; `aria-label`ed slider semantics (`role="slider"` with `aria-valuetext` = date) and keyboard arrows.
- Visually hidden summary (`sr-only`) with today's headline, fire totals and where the air came from; shown visibly if the globe fails (Review Focus 5).
- Reduced motion: no autoplay, wind still unless opted in (existing `WindMotion` pattern).
- Preload: keep the `<link rel="preload">` for `SMOKE_URL` and `REPLAY_URL`; preconnect to `gibs.earthdata.nasa.gov`, `tiles.openfreemap.org`, `cdn.jsdelivr.net`.

- [ ] **Step 1: Build it**, then `npx tsc --noEmit`, `npm run lint`, `npm test`.
- [ ] **Step 2: Production build** `npm run build`: `/map` is static with `Revalidate 30m`; no new `ƒ` routes compared with before (list them).
- [ ] **Step 3: Screenshots** (Haiku agent, playwright-core with `/usr/bin/google-chrome-stable` and `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`): 390×844 and 1440×900, default view, PM2.5, CO, a past day (with a hand-made `data/history` day served by routing the jsDelivr URL to a local fixture), a forecast day, `?view=path`, and with WebGL disabled (`--disable-webgl`). Look at every one.
- [ ] **Step 4: Commit** `Map: the full-screen air globe replaces the old map page`.

### Task 11: Now: one smoke map

**Files:**
- Modify: `src/components/HazeOrigin.tsx`, `src/components/NowView.tsx`
- Delete: `src/components/SmokeMap.tsx` (after moving what is needed; grep for other users)
- Move: `src/components/Neighbours.tsx` stays, now rendered on Now under the air map

**Interfaces:**
- Consumes: `colorOf`/`rampCss` and `PM25` pollutant (Task 2); `SmokeGrid` (`/api/smoke`, already preloaded on Now? check `src/app/page.tsx`; add the preload if missing); the image projection `onImage` and `SAT_BOX` (`src/lib/satellite.ts`), the same grid as the wind there.

Behaviour (spec):
- PM2.5 veil over the satellite image: draw the CAMS PM2.5 field for the selected time with `colorOf` into a canvas under the wind streaks (same smoke palette as the globe; Normal nearly invisible).
- Time slider under the map: the 5 replay days (path, fires, wind of each day) and the next 3 days of the smoke grid in 3-hour steps; the default is now. Reuse what `SmokeMap.tsx` does for its slider and labels (read it first) instead of writing a second version.
- Tap to read: tapping the map shows PM2.5 at that spot and time (bilinear from the grid) and its NEA band, as SmokeMap does now ("Tap the map to read the smoke level at a spot").
- Neighbours section moves to Now right after this map (title "Neighbours").
- Keep the existing Air journey card, Smoke on the way text, legend line and link (`/map?view=path`).

- [ ] **Step 1: Build it**; `npx tsc --noEmit`, `npm run lint`, `npm test`.
- [ ] **Step 2: Screenshots** at 390 (dark) and 1280 (light) of `#origin`, with production replay data routed in (see `scratchpad/origin.cjs` pattern) and the slider at now, a past day and a forecast step. Look at each.
- [ ] **Step 3: Commit** `Now: one smoke map with the PM2.5 veil, time slider and tap-to-read; Neighbours moves here`.

### Task 12: Wrap-up

**Files:**
- Modify: `AGENTS.md` ("Where things are": globe, history, timeline, pollutants), `README.md` (what the map shows and the data sources; no deployment), `src/lib/releases.ts` only if the owner wants a What's new entry (ask; do not add one unasked)
- Check: `src/app/llms.txt` text and `sitemap`/manifest shortcuts mention the map correctly

- [ ] **Step 1: DRY sweep:** grep new strings and helpers for duplicates (AGENTS.md rule); remove dead code (`npx tsc --noEmit` plus grep for exports with no importers among the files touched).
- [ ] **Step 2: Full checks:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3: Commit** `Docs: globe, history and pollutants`.
- [ ] **Step 4: Report to the owner:** what changed, screenshots, the build's route table, and the two owner actions: push when ready, then run "History" from GitHub Actions with `from = 2026-08-01` once.
