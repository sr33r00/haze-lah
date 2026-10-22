# /map as a full-screen air globe

Date: 2026-10-23. Status: draft for the owner's review.

## Why

Haze Lah is meant to become Singapore's air tracker, not only a haze page. The map should be its main feature: open it and see, on one real globe, how bad the fires are, how the wind is moving, where our air came from, where today's smoke is going, and what is in the air. A competing site (sea-haze.teyou.dev) shows a dark globe with a season timeline; ours must look better, stay simpler on a phone, and use all the data we already collect.

The owner approved the look of a throwaway test build (`/spike-globe`, `src/components/spike/`): NASA Black Marble Earth with an atmosphere glow, flowing wind, glowing fires, the purple air path, and a smoky PM2.5 veil. This design turns that test into the real `/map`.

## Goals

1. `/map` is one full-screen globe on phone and desktop, with the look of the test build.
2. A **timeline from 1 August 2026 to 3 days ahead**: one bar per day (fire count), drag or play, and every layer moves to that day.
3. **Measured readings as dots** on the globe, so people see real measurements next to the model's colours.
4. **More pollutants** in the colour layer, from the same Copernicus request: PM2.5, PM10, CO, NO2, SO2, ozone, dust, plus the satellite smoke and CO pictures we already build.
5. **Daily history saved in the repo** from 1 August 2026 onwards, so the timeline can show the whole season and keeps growing.

## Non-goals (this version)

- Tap anywhere for a reading. Share the globe as a picture. (Planned next.)
- Accounts, alerts or settings on the map.
- Hourly history: history is kept at 3-hour steps, the timeline moves by day (and by 3 hours within today and the forecast).

## Anti-goals (a failure even if it works)

- **A cluttered phone screen.** The map must stay mostly map: one top bar, one bottom card, the timeline. No stacked panels over the globe.
- **Alarm on clean days.** Colours follow NEA's bands; Normal air is nearly invisible. Never draw clean air in a danger colour.
- **Breaking the free Vercel plan.** No new server work per visitor. See Constraints.
- **Fake precision.** Model values are labelled as model; measurements as measured; trajectories as estimates.

## Look (decided with the owner)

Keep the test build's base and layering:

- **Earth:** NASA GIBS VIIRS Black Marble over a dimmed, desaturated Blue Marble relief; globe projection; atmosphere glow (`sky`); near-black space; camera tilted so the limb shows.
- **Borders:** country borders bright and solid ("really clear"), coasts a step quieter, province lines faint. Few, quiet place labels.
- **Fires:** red to orange to yellow by heat (density heatmap zoomed out, glowing points zoomed in). Older days dimmer. New fire zones: thin cyan ring.
- **Air's path:** purple (`TRAIL_COLOR`) with a soft glow and day marks. **Smoke on the way:** dashed amber line.
- **Wind:** thin, faint white flowing streaks (existing engine).
- **Pollutant colours:** "smoke" palette, brown to rust to dark blood red, keyed to NEA's 1-hour PM2.5 bands (`PM25_BANDS` in `src/lib/bands.ts`): Normal nearly invisible, Elevated brown haze, High rust, Very high dark red. Legend uses NEA's band names. For other pollutants, use the same smoky ramp keyed to that pollutant's own official bands where Singapore or WHO publishes them (cite the source in the code); where none exist, use the ramp with a plain low/high legend. Fires, path, new zones and the pollutant ramp must stay visually distinct.

## The screen

Phone (390 wide) and desktop (1280+), dark only (the globe is always dark, whatever the site theme).

- **Top bar:** back to Haze Lah; the colour layer picker (PM2.5 first, then PM10, Smoke (satellite), CO, NO2, SO2, O3, Dust, Off). On a phone it is a horizontally scrolling row or a compact menu; desktop shows them inline.
- **Bottom card:** one data-built headline (as in the test: where today's air came from, or "Smoke from X could reach Singapore in about N h"), one line of facts, the colour legend for the chosen layer, and the symbol key (fire, new zone, path, smoke on the way, measured dot). On a phone it can be dragged up for more and down to a slim strip; collapsed it must not cover more than about a third of the screen.
- **Timeline:** under or inside the bottom card. Bars per day from 1 Aug to the last forecast day; past days solid, forecast days hatched; today marked. Play button. Event marks on the bars where we have the data (first day PSI above 100 and above 200 in Singapore). The selected day's date is always shown.
- **Measured dots:** small dots coloured by their reading on the same scale as the layer, with the number on tap or hover:
  - NEA's five regions (PM2.5 now; PSI in the label),
  - Malaysia's API stations,
  - community sensors (OpenAQ/AirGradient),
  - Indonesian cities: these are model values, so drawn hollow and labelled "model".
  Dots show for today only (no history of station readings in this version, except NEA, see History).
- **The globe and the selected day:** each layer shows the selected day: fires of that day, wind and PM2.5 at the selected 3-hour step, that day's back-trajectory into Singapore, and the satellite pictures of that date. "Smoke on the way" shows for today and the forecast days only.

## Data

What we already fetch (see `src/lib/sources/`):

| Data | Source | Today | History to keep |
| --- | --- | --- | --- |
| Fire hotspots | NASA FIRMS (VIIRS) | last 5 days | yes, from 1 Aug |
| Wind, 850 hPa | Open-Meteo (ECMWF) | last 7 days to +3 | yes |
| PM2.5 grid | Open-Meteo CAMS | next 3 days | yes |
| PM10, CO, NO2, SO2, O3, dust grids | Open-Meteo CAMS (add to the same request) | next 3 days | yes |
| Smoke and CO pictures | NASA GIBS | by date | no: fetched by date on demand (existing `/api/globe/[layer]`) |
| NEA readings | data.gov.sg | now | daily max PSI and PM2.5 per region |
| Malaysia API, community sensors, Indonesian cities | APIMS, OpenAQ, Open-Meteo | now | no |

### History in the repo (decided by the owner: from 1 August, saved in the repo)

- One file per Singapore day under `data/history/` (for example `data/history/2026-08-01.json`), plus a small `data/history/index.json` with what the timeline bars need: date, fire totals per area, Singapore's daily max PSI and PM2.5.
- Each day holds: fires (the strongest N with lat, lon, FRP; plus totals per area, so counts stay right), wind u/v and every CAMS pollutant on the existing 1° grid at 3-hour steps, the 72 h back-trajectory into Singapore at 2 pm (as the replay does now), and NEA's daily figures.
- Compact: numbers rounded to what the map needs; a target of about 100 KB per day on disk before git's compression. The builder decides the exact layout.
- **Backfill once** from 1 August 2026 with a script (FIRMS by date range, Open-Meteo historical air quality and historical forecast for the wind, data.gov.sg by date). Run it locally or as a manual workflow, then commit the files.
- **Daily job:** a scheduled GitHub Actions step (with the external cron trigger if GitHub's schedule is unreliable, as for alerts) writes yesterday's file and updates the index, and commits it as the data bot. Data-only commits do not trigger Vercel builds (`scripts/vercel-ignore.sh`).
- **How the browser gets it:** past days are immutable once written, so the browser loads them from a free CDN for the GitHub repo (jsDelivr, pinned per file), not from Vercel. Add that host to the CSP. Today and the forecast come from the existing live routes (`/api/replay`, `/api/smoke`, extended with the new pollutants).
- History is loaded lazily: the index first (for the bars), then a day's file when that day is shown or about to be shown while playing.

## Constraints

- **Vercel free plan** (see the owner's notes): no new per-visitor server work. The globe renders in the browser. NASA imagery loads straight from NASA. History comes from the CDN. The only server changes are a larger cached Open-Meteo response every 3 hours and the existing globe picture routes.
- **Performance:** MapLibre stays lazily loaded. First paint of `/map` shows the globe quickly; history and extra layers load after.
- **Licences and attribution:** NASA GIBS and FIRMS, Copernicus (the CAMS notice), OpenFreeMap/OpenStreetMap, NEA (Singapore Open Data Licence), APIMS, OpenAQ. Attribution in the bottom card, as in the test build.
- **Repo rules:** AGENTS.md (DRY, accessibility, 44 px targets, `aria-pressed`, reduced motion: wind stays still unless the viewer opts in, as elsewhere).

## What happens to today's /map

The current `/map` sections (Leaflet smoke map, hotspot chart, "From space" card, Neighbours list) are replaced by the globe: the timeline bars replace the hotspot chart, the measured dots replace the Neighbours list, and the globe replaces both maps. **My call, to confirm with the owner.** Links into `/map` from other pages (for example "See it on the map" on Now) must land on the globe at the same subject.

## Already built (context, not part of this work)

- The Now page "Where today's air came from" card now has wind streaks, day marks, new fire zones (`newFires` in `src/lib/replay.ts`, 50 km rule) and the forward smoke path even when it misses Singapore. Not yet deployed. The globe must use the same `newFires` rule.

## Decisions after review (my calls unless marked)

- **Satellite pictures (Smoke, CO) on older days:** the browser loads NASA GIBS's own tiles for that date straight from NASA (the AIRS CO and OMPS aerosol layers are served by date), restyled with raster opacity and saturation to sit quietly on the dark globe. The server-built textures of `/api/globe/[layer]` stay for the last 8 days, where they already exist and are cached; no new server builds for older days. If a GIBS layer has no tile for a date, the layer shows "No satellite picture for this day".
- **Measured dots per layer:** NEA's five regions show the chosen pollutant where NEA reports it (PM2.5, PM10, O3, CO, SO2, NO2 sub-indices or concentrations). Malaysian stations, community sensors and Indonesian cities report PM2.5 (or Malaysia's API) only, so they show PM2.5 whatever the layer, with "PM2.5" in their label; on Dust, Smoke and Off they hide. Dots show for today only; past days show no dots (NEA's daily max is not a 1-hour reading, so it would be on the wrong scale).
- **Forecast days:** the bars are hatched and empty (no fire forecast exists), labelled "Forecast". The fire layer shows today's fires, dimmed, and no new-zone rings. The air's path is traced back from the forecast wind (the replay code already can, as for Smoke on the way). Pollutant colours are the CAMS forecast.
- **Timeline length:** it starts at 1 August 2026 and grows (owner: "from August 1 onwards"). Scrubbing is by drag on the whole bar strip, not by tapping a 4 px bar; the strip shows the newest ~90 days and scrolls back when longer. If it passes about a year, revisit.
- **History index freshness:** day files load from jsDelivr at `@main` (they never change once written). The daily job calls jsDelivr's purge for `index.json` after it commits. The repo is public, which jsDelivr needs.
- **Backfill:** runs as a manual GitHub workflow (the FIRMS key is a GitHub secret, not on the owner's machine), 5 days per FIRMS request. Use one FIRMS product for the whole history so the bars have no step: the builder checks which product still covers 1 August (NRT or standard processing) and uses it from then on for history; the live pages keep NRT.
- **Accessibility and crawlers:** the bottom card's headline and facts are real text, and the page keeps a visually hidden summary (today's air, fires, where it came from) so screen readers and crawlers get the substance. Deep links: "See it on the map" opens the air-path view; `/map#space` and other old anchors open the globe at its default view.

## Left to the builder

- File layout of `data/history/` and the exact rounding.
- How the spike code is folded into real components (reuse `GlobeMap.tsx`, `globeWind.ts`, `basemap.ts`; delete the spike after).
- Exact timeline interaction details, provided the anti-goals hold.
- Colour stops for pollutants other than PM2.5, within the rules above.
