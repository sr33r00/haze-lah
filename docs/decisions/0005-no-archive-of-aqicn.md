# 0005: Use AQICN data live only

Date: 2026-10. Status: accepted.

## Context

The Now map has a US AQI view that adds stations from the World Air Quality Index Project (AQICN, waqi.info) beside NEA's. AQICN's API terms forbid redistributing cached or archived data. The project, by contrast, archives other sources on purpose ([ADR 0004](0004-history-in-the-repository.md)) and the repository is public.

## Decision

AQICN station data is a live-only source.

- `fetchAqiStations` (`src/lib/sources/waqi.ts`) is called only from `fetchInputs` inside `getHazeData`.
- Nothing writes it to `data/`, the forecast archive, the history or readings files, or script output. `scripts/archive.ts` stores chosen forecast fields only; `scripts/readings.ts` and `scripts/history.ts` do not call the AQICN fetcher; `scripts/alert.ts` keeps alert state only.
- Wherever the data is shown, its credit line stays: `WAQI_NAME` and `WAQI_URL` in `src/lib/links.ts`, used under the map, on the About page and in `/llms.txt`.
- The token is read from `WAQI_TOKEN` on the server. Without it the list is empty and the map shows no AQICN stations.
- The map explains that US AQI reads higher than Singapore's PSI for the same air (`US_AQI_NOTE`).

## Consequences

- There is no history of AQICN stations, so the globe timeline cannot replay them.
- The data does pass through the shared 30-minute cache and the live `/api/haze` response. That is the same live path as the page itself; it is not stored in the repository.
- Any new feature that stores or exports page data must leave `aqiStations` out. Check this when you add one.
- A new place that shows AQICN data needs the credit line there.
