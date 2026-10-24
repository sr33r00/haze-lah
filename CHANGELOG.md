# Changelog

All notable changes to Haze Lah are listed here. The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The in-app "What's new" sheet shows the highlights of the current release. Data-only commits by the archive jobs are not listed.

## [Unreleased]

Nothing yet.

## [1.6.1] - 2026-10-24

### Fixed

- A deploy whose build machine missed a source (such as AQICN's stations) now refreshes within 5 minutes instead of 30.

### Changed

- What's new also lists the new forecast and the globe's fly-in.

## [1.6.0] - 2026-10-24

### Changed

- Plan your day picks the steadiest session (lowest worst likely hour), lets you set how long (30 min to 3 h), adds Football, and shows fine dust breathed as cigarettes and times a normal day. The Telegram alert's best time out follows the same rule.
- The public `/api/haze` JSON no longer includes AQICN's stations (`aqiStations` is empty), as AQICN's terms forbid redistributing its data. The Now map still shows them.
- `.env.example` and the README list `FIRMS_SOURCE`, `ACCURACY_URL` and `HAZE_JSON_URL`.

## [1.5.0] - 2026-10-24

### Added

- Forecast page rebuilt: one answer at the top, then a 48-hour instrument you can scrub, with PM2.5 and its likely range, wind and rain lanes, the peak and the best window. The 5-day rows show the chance of PM2.5 above 55 µg/m³ and the day's wind, and a "how sure we are" section shows the error by lead time.
- PM2.5 / US AQI toggle on the Now map, with AQICN's stations in Singapore. Every reading is a numbered badge, a blue dot shows where you are, and a note under the scale explains each colour.
- Smoke from space on Photos: a Himawari-9 loop of the last hours over Sumatra, Singapore and Borneo, or NASA smoke thickness for each of the last 7 days (Live / Last 7 days toggle). Tap a picture for full screen with pinch-zoom.
- Wind outlook (where the air comes from, every 3 hours for 3 days, with fires upwind), and rain total and gusts in the 5-day outlook.
- Donate dialog on the site (Ko-fi's panel), from the header, the support card, What's new, About and after sharing.

### Changed

- Photos opens with the road cameras and webcams first.
- News counts the whole haze spell, up to two clear days apart, instead of only the last week.
- Support moved from Buy Me a Coffee to Ko-fi.
- The 5-day strips never look safer than the day's expected PSI.
- What's new rows are tappable and have icons.

### Fixed

- The globe's timeline still starts on 1 August when a content blocker stops GitHub's raw host.

### Removed

- The old forecast chart and the wind strip on the Forecast page.

## [1.4.0] - 2026-10-23

### Added

- The globe opens on the whole Earth and flies down to Singapore. Tap to skip.
- Readings archive: NEA hourly readings for the five regions from 1 August, plus Malaysian stations and community sensors, saved daily in `data/readings/`.

### Changed

- The globe loads faster: NASA base tiles are fetched once and kept for the landing, and the style loads with the globe's code.
- What's new is shown to everyone again.

## [1.3.1] - 2026-10-23

### Changed

- What's new is shown once more.
- The add-to-home-screen card is high contrast, and its buttons are 44 px.

## [1.3.0] - 2026-10-23

### Added

- Air globe at `/map`: a full-screen globe with a timeline from 1 August to the forecast, and seven pollutants (PM2.5, PM10, carbon monoxide, nitrogen dioxide, sulphur dioxide, ozone and dust). Measured readings appear as dots, and new fire zones are marked.
- Daily history files in `data/history/` for the globe's past days, built at 01:30 SGT.
- On the Now map: wind, day marks, and where smoke goes next.
- Tests: `npm test` runs the `node:test` suite.
- A GNU AGPL v3 licence with an attribution term (`NOTICE`), and a `CODEOWNERS` file.

### Changed

- Now has one smoke map with a PM2.5 veil, a time slider and tap-to-read. It takes over from the separate map page and from the Neighbours list.
- Pages and data are rebuilt every 30 minutes and shared by all pages, which cuts server load.
- Traffic camera photos load straight from data.gov.sg.

### Fixed

- Clearer failures and gaps on the globe and map, quieter while dragging, and faster layers on desktop.

## [1.2.0] - 2026-10-21

### Added

- Fine dust breathed and times a normal day on the cigarette card.
- Air journey: how today's air travelled to Singapore, with a picture you can share.
- Smoke on the way: where smoke from today's strongest fires is heading.
- What's new sheet for returning visitors.
- AQICN panel, showing the AQICN number and why it is higher than NEA's.
- Wind arrows, each day's air path and the smoke forecast path on the globe.
- Supporters named on the support card and About.

## [1.1.0] - 2026-10-21

### Added

- Photos tab: LTA road cameras, Windy webcams and NASA satellite pictures.
- Smoke and carbon monoxide from space on a zoomable vector globe, with date and pass time and tap to read values.
- Replay of the past 5 days on the map, with the air's back-trail, and a Singapore sensor map on Now that shows the nearest sensor and region.
- Where today's air came from, and the pollutant that sets the PSI, on Now.
- Haze outlook, activity planner and an add-to-home-screen prompt.
- Telegram alerts: a channel post when the PSI band changes or NEA issues a haze update, with a live image card, an hourly update and CNA and Straits Times headlines.
- Guide with sourced answers on masks, exercise, schools, work and health, and an About page with grouped data sources.
- Mask, purifier and school guidance from NEA, MOH, MOE and ECDA, and a comparison of this week's peak with NEA records since 2014.
- Cigarette comparison, using Berkeley Earth's 22 µg/m³ per cigarette.
- Community sensors from OpenAQ on the map.
- In-site feedback form, sent privately to the owner.
- Light and dark theme toggle, tap-to-explain stats, app icons, a glance view and desktop layouts.
- Search and sharing metadata, a sitemap, structured data, a live share image and `llms.txt`.

### Changed

- The go-out advice follows the 1-hour PM2.5, as NEA advises for the next few hours. Advice text was checked against NEA, MOH, MOE and MOM.
- The page opens on the region with the highest 24-hour PSI until you pick one.
- News is a clearer feed, with colour-coded day headings.

### Fixed

- Fresher PSI readings.
- The wind layer keeps the last good grid when Open-Meteo is overloaded.
- Dead MOE and ECDA links in the Guide.

### Removed

- Swipe between tabs.

## [1.0.0] - 2026-10-16

### Added

- Four tabs: Now, Forecast, Map and News.
- Anonymous page-view counts (Vercel Web Analytics) and a privacy note.
- A support link.

## [0.1.0] - 2026-10-15

### Added

- First public version: a mobile-first Singapore haze tracker with live NEA PM2.5 and PSI for the five regions, and Malaysian stations from APIMS.
- PM2.5 forecast from the Copernicus CAMS model, calibrated against NEA's readings.
- Hourly archive of every forecast, scored against NEA and against two baselines, with a hazy-day hit rate.
- Plain go-out advice, shareable region links and an installable app.
- Forecast smoke map, fire counts and a wind dial, "Plan your day", NEA news timeline and 7-day PSI history.
- Feedback issue form.

[Unreleased]: https://github.com/sr33r00/haze-lah/compare/v1.6.1...HEAD
[1.6.1]: https://github.com/sr33r00/haze-lah/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/sr33r00/haze-lah/compare/abc6ebe...v1.6.0
[1.5.0]: https://github.com/sr33r00/haze-lah/commit/abc6ebe
[1.4.0]: https://github.com/sr33r00/haze-lah/commit/305c8ae
[1.3.1]: https://github.com/sr33r00/haze-lah/commit/afc88c7
[1.3.0]: https://github.com/sr33r00/haze-lah/commit/3868fec
[1.2.0]: https://github.com/sr33r00/haze-lah/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/sr33r00/haze-lah/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sr33r00/haze-lah/compare/f936552...v1.0.0
[0.1.0]: https://github.com/sr33r00/haze-lah/commit/f936552
