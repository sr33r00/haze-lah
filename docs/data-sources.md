# Data sources

Every upstream the site or its scheduled jobs call, read from `src/lib/sources/`, `src/lib/satellite.ts`, `src/lib/globe.ts` and `src/lib/jobs/`. For licences and terms in full, see the data sources table in [README.md](../README.md). This page does not repeat them. Where a source needs a credit, the notes below say where it is shown.

Keys are read from environment variables listed in `.env.example`. Every key is optional: a missing key turns off one feature and nothing else. How failures behave is in [architecture](architecture.md#failure-handling).

"Refresh" is how often the site asks again. Most sources are read only when the shared 30-minute page data is rebuilt (`getHazeData` in `src/lib/data.ts`).

## Summary

| Source | Host | Fetched by | Refresh | Key (env var) | Without the key |
|---|---|---|---|---|---|
| NEA PSI and PM2.5 | `api-open.data.gov.sg` | `nea.ts` | 30 min | `DATA_GOV_SG_API_KEY` (optional) | Works anonymously, with a lower rate limit |
| Malaysia APIMS | `eqms.doe.gov.my` | `apims.ts` | 30 min | none | n/a |
| Copernicus CAMS, ECMWF wind and rain | `air-quality-api.open-meteo.com`, `api.open-meteo.com` | `openmeteo.ts` | 30 min to 3 h | none | n/a |
| Open-Meteo archives (history jobs only) | `historical-forecast-api.open-meteo.com`, `air-quality-api.open-meteo.com` | `openmeteo.ts` | Daily job | none | n/a |
| NASA FIRMS | `firms.modaps.eosdis.nasa.gov` | `firms.ts` | 30 min | `FIRMS_MAP_KEY` | No fires; the page says so |
| OpenAQ | `api.openaq.org` | `openaq.ts` | 30 min | `OPENAQ_API_KEY` | No community sensors |
| AQICN (waqi.info) | `api.waqi.info` | `waqi.ts` | 30 min | `WAQI_TOKEN` | No US AQI stations |
| News feeds | `www.nea.gov.sg`, `www.weather.gov.sg`, `www.channelnewsasia.com`, `www.straitstimes.com` | `news.ts` | 30 min | none | n/a |
| LTA traffic cameras | `datamall2.mytransport.sg` or `api.data.gov.sg` | `traffic.ts` | 1 min in memory, 5 min at the CDN | `LTA_DATAMALL_KEY` (optional) | 8 cameras from the open feed instead of about 90 |
| Windy webcams | `api.windy.com` | `windy.ts` | 5 min | `WINDY_WEBCAMS_KEY` | No webcams |
| NASA GIBS | `gibs.earthdata.nasa.gov` | `gibsTexture.ts` (server), `satellite.ts` and `globe.ts` (browser) | 6 h to 7 days (server picture) | none | n/a |
| OpenFreeMap, OpenStreetMap | `tiles.openfreemap.org`, `tile.openstreetmap.org` | Browser | Browser cache | none | n/a |
| The project's own data (private R2 bucket) | none: read through the `DATA` binding on the server, and `/data/history/` on this origin for the browser | `dataStore.ts`, `historyClient.ts`, `accuracy.ts` | See [data pipelines](data-pipelines.md) | none | History and accuracy sections hide |

`FIRMS_SOURCE` picks the FIRMS product; it defaults to `VIIRS_SNPP_NRT`.

## NEA via data.gov.sg

- **File:** `src/lib/sources/nea.ts`. Base `https://api-open.data.gov.sg/v2/real-time/api`.
- **Fetched:** `/psi` (24-hour PSI, sub-indices, 24-hour PM2.5 and PM10, 1-hour NO2) and `/pm25` (1-hour PM2.5), each for the five regions.
  - `fetchNeaNow` reads the undated `/psi` and today's dated feed and keeps the newest item, because the undated endpoint has been seen serving a reading hours old.
  - `fetchNeaPm25History` reads yesterday and today (Singapore time) and builds a series per region and an island mean.
  - `fetchPsiDaily` reads the highest PSI of each of the last 7 days, one day at a time, because data.gov.sg allows 6 anonymous calls per 10 seconds. Past days are kept for a day; today is not.
  - `fetchNeaDayFeeds` and `fetchNeaDay` read one past day for the history and readings jobs, with a 4-second pause (`NEA_PAUSE_MS`) between days.
- **Key:** `DATA_GOV_SG_API_KEY`, sent as `x-api-key`. Optional; it raises the rate limit. `getJson` waits 10 seconds once after a `429`.
- **If it fails:** the whole page data is treated as incomplete and is not stored (see architecture). Both PSI and PM2.5 are needed.
- **Terms:** Singapore Open Data Licence (`OPEN_DATA_LICENCE` in `src/lib/links.ts`). The About page and footer carry the attribution.

## Malaysia APIMS

- **File:** `src/lib/sources/apims.ts`. An ArcGIS layer behind the Department of Environment's APIMS site.
- **Fetched:** every station within 700 km of Singapore, nearest first, with its latest hour of API (air pollutant index), PM2.5, PM10, O3, CO, SO2 and NO2. APIMS serves only that latest hour, never history.
- **Time:** the feed stores Malaysian local time as if it were UTC; the code subtracts 8 hours.
- **Also used by:** the hourly capture in `captureApims` in `src/lib/jobs/readings.ts`, which builds the readings archive (see [data pipelines](data-pipelines.md)).
- **Terms:** public data, attributed on the About page.

## Copernicus CAMS and ECMWF, via Open-Meteo

- **File:** `src/lib/sources/openmeteo.ts`.
- **Live page data (30 minutes):**
  - `fetchCamsSingapore`: CAMS global PM2.5 at Singapore, 2 past days and 5 forecast days, hourly. This is the baseline of the [forecast](forecast.md).
  - `fetchWeather`: wind and direction at 850 hPa, rain probability, rain and gusts, 1 past day and 5 forecast days.
  - `fetchUpwindModel`: CAMS PM2.5 for five Indonesian cities (Pekanbaru, Jambi, Palembang, Pontianak, Palangka Raya). There is no open real-time station feed for them, so these are model values, not measurements.
- **Regional grid (3 hours):** `fetchSmokeGrid` (for `/api/smoke`) asks for a 1 degree grid, latitude -6 to 7 and longitude 95 to 120. It returns PM2.5 and the other CAMS gases, sampled every 3 hours for about 72 hours, plus 850 hPa wind. `fetchWindFrames` returns the past week and next 3 days of wind for the replay.
- **History jobs only:** `fetchHistoryAQ` and `fetchHistoryWind` read Open-Meteo's archives for the history job (`src/lib/jobs/history.ts`). They use a 90-second timeout and retry after 10 s and 65 s.
- **Key:** none.
- **Terms:** CC BY 4.0; contains modified Copernicus Atmosphere Monitoring Service information. The credit is on the About page and in the footer.

## NASA FIRMS

- **File:** `src/lib/sources/firms.ts`, parser in `firmsCsv.ts`.
- **Fetched:** VIIRS active fire detections for the box 95, -6.5, 120, 7.5 (Sumatra, Peninsular Malaysia, Borneo), last 5 days. Low-confidence detections and fires outside the three areas are dropped. The 5-day CSV is over 2 MB, above Next's fetch cache limit, so only the parsed rows are cached (30 minutes). The map keeps the 600 strongest fires.
- **Key:** `FIRMS_MAP_KEY` (free). Without it `fetchFires` returns `available: false` with a reason, and the page shows no fire data.
- **History:** `fetchFiresRange` reads old days in 5-day windows for the history job. The near-real-time product keeps only recent months, so an empty answer is retried on the standard-processing product (`_SP`). A window that stays empty throws, so a false "no fires" is never saved.
- **Terms:** NASA open data. Credit on the About page.

## OpenAQ

- **File:** `src/lib/sources/openaq.ts`. API v3.
- **Fetched:** fixed low-cost PM2.5 sensors inside a box around Singapore (103.6, 1.15 to 104.1, 1.48). Mobile sensors, reference monitors (NEA's, shown from NEA instead) and calibration or NASA entries are dropped. Values outside 0 to 1000 µg/m³ are treated as faulty. A reading older than 3 hours (`MAX_SENSOR_AGE_MS`) is not shown.
- **History:** `fetchSensorHours` reads a sensor's past hourly averages for the readings archive.
- **Key:** `OPENAQ_API_KEY` (free). Without it the live site shows no community sensors, and the readings job skips them with a warning and writes the reason into the day file.
- **Terms:** see the README table. Credit on the About page.

## AQICN (waqi.info)

- **File:** `src/lib/sources/waqi.ts`. Official JSON API, `/v2/map/bounds`.
- **Fetched:** stations inside the Singapore box with a recent reading, shown on the Now map's US AQI view. NEA's own regional monitors (named "North, Singapore" and so on) are dropped because the map already shows NEA's regions. Faulty values (negative or above 999) are dropped.
- **Key:** `WAQI_TOKEN` (free). Without it no stations are shown.
- **Rule: live only.** AQICN's terms forbid redistributing cached or archived data. The stations are fetched only inside `getHazeData`. They are never written to the data bucket, to the forecast archive, to the history or readings files, or to any job result. The archive job saves only chosen fields of the forecast data, and the alerts job keeps only its alert state. They pass through the 30-minute page cache, and the public `/api/haze` response sends `aqiStations` empty, so other sites cannot take them from us. See [ADR 0005](decisions/0005-no-archive-of-aqicn.md).
- **Credit:** `WAQI_NAME` and `WAQI_URL` in `src/lib/links.ts`. The credit line must stay wherever the data is shown: it is under the map in `src/components/SgMap.tsx`, on the About page, and in `/llms.txt`. If you show AQICN data in a new place, show the credit there too.
- **Token handling:** the token is in the request URL, so errors log only the API status, never the response body.

## News feeds

- **File:** `src/lib/sources/news.ts`.
- **Fetched:** the NEA news RSS and the Meteorological Service Singapore 24-hour forecast Atom feed, plus haze headlines from the CNA and Straits Times RSS feeds. NEA items are kept only if they mention haze terms; outlet items only if the title does, and only from the last 7 days (at most 6 per outlet).
- **Safety:** `safeUrl` only passes links on the four allowed hosts. Titles and summaries are stripped to plain text.
- **If it fails:** the other feeds still show; only if every feed fails is "News" reported as an error.
- **Attribution:** each item links back to the publisher. Credit on the About page.

## LTA traffic cameras

- **File:** `src/lib/sources/traffic.ts`.
- **Fetched:** with `LTA_DATAMALL_KEY`, DataMall's camera images (about 90 cameras); without it, the open `api.data.gov.sg` feed (8 cameras). The list is kept in server memory for 60 seconds, because DataMall links expire after about 5 minutes.
- **Photos:** DataMall photos pass through `/api/camera/[id]`, so the key and the real link stay on the server. data.gov.sg links are public, so the browser loads those directly.
- **Terms:** Singapore Open Data Licence.

## Windy webcams

- **File:** `src/lib/sources/windy.ts`.
- **Fetched:** active webcams within 60 km of the island centre, list cached 5 minutes (`WEBCAM_TTL`).
- **Key:** `WINDY_WEBCAMS_KEY` (free tier). Without it no webcams are shown.
- **Terms (free tier):** use the image URLs exactly as given, link each image to its Windy page, show the credit, never stretch an image, use the data as delivered, keep the key secret and do not call the API intensively. `GroundViews` links each image to its webcam page and caps its display width at the image's own width.

## NASA GIBS

- **Server:** `src/lib/sources/gibsTexture.ts` fetches the OMPS NOAA-20 and NOAA-21 aerosol index passes and their colour map and builds the smoke picture. See the [architecture](architecture.md#server-built-satellite-picture) and [ADR 0006](decisions/0006-server-built-satellite-pictures.md). Passes are tried twice with a 20-second timeout; the colour map is cached a day.
- **Browser:** `src/lib/satellite.ts` and `src/lib/globe.ts` build image and tile URLs (Himawari-9 loop, relief, Blue Marble and Black Marble base pictures, smoke tiles). The browser loads them straight from NASA. The CSP allows the host.
- **Key:** none. **Terms:** NASA open data.

## Map data

- OpenFreeMap vector tiles for the globe (`src/lib/basemap.ts`) and OpenStreetMap tiles for the Leaflet maps (`SgMap`, `OriginMap`). Both are loaded by the browser. Attribution is shown on the maps; the licences are in the README table.
- `public/world.json` is a Natural Earth outline (public domain) that stands in for heavy world tiles when zoomed out.

## Services that receive data

These are not data sources, but the code calls them.

| Service | Used by | Key |
|---|---|---|
| Telegram Bot API | `src/lib/jobs/alerts.ts` (alerts) and `src/app/api/feedback/route.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `FEEDBACK_CHAT_ID` |
| Resend | `src/app/api/feedback/route.ts` | `RESEND_API_KEY`, `FEEDBACK_EMAIL` |

## Adding a source

See [development](development.md#adding-a-data-source).
