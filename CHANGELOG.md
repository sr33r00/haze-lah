# Changelog

All notable changes to Haze Lah are listed here. The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The in-app "What's new" sheet shows the highlights of the last three releases. Data-only commits by the archive jobs are not listed.

## [Unreleased]

## [1.14.0] - 2026-10-27

### Added

- A best-time line in the haze card: when the air is cleanest for the activity chosen in Plan your day.
- A one-question poll, "Tell me when it's clean": would you use an opt-in Telegram alert for your area. Votes are anonymous counts (no IP, no user agent), with a limit on repeat votes from one connection.
- A daily poll tally to the owner: one private Telegram message at the first hourly run from 08:00 SGT when the counts changed, sent to the feedback chat and not the public channel.

### Changed

- Settings (such as the activity and group) stay in step across the page and between open tabs.
- The feedback form's rate limit uses the Cloudflare client IP.
- Both Telegram senders (alerts and feedback) share one helper.
- The "What's new" sheet and the About page list the last three releases, and the sheet keeps "Got it" in view while the list scrolls.

## [1.13.0] - 2026-10-27

### Changed

- The weather moved from its own "Outdoor conditions" section into the haze card on the Now page: a compact row of tiles under the PM2.5 and PSI numbers with the measured NEA air temperature (and what it feels like), the last UV reading, the 2-hour rain forecast and lightning. Tap a tile to see what the reading means and where and when it was measured.
- The AQICN note under the readings is one line.

### Removed

- The NEA advice line at the bottom of the haze card. What to do already covers it.

## [1.12.0] - 2026-10-27

### Added

- Outdoor conditions under the haze answer: NEA's 2-hour rain forecast for the nearest town, measured heat stress (WBGT), the last UV reading and lightning strikes within 15 km in the last 30 minutes. It refreshes every 5 minutes on its own, apart from the haze data.
- Singapore is outlined in red on both maps (URA Master Plan 2019 via data.gov.sg), and the smoke map points it out with a label.

### Changed

- Plan your day weighs rain (Open-Meteo chance of rain) and UV (WHO categories) as well as the air: the best time skips hours with rain likely or very high UV, and shows the rain chance and feels-like temperature.
- On laptops and big screens the Now page uses the whole width: the sections in one column on the left, and one tall map on the right that switches between the readings now and where the air came from. The smoke and wind fill the map edge to edge. Phones are unchanged.
- NEA data is fetched with a data.gov.sg API key, including by the refresh Worker.

## [1.11.1] - 2026-10-26

### Fixed

- Puff's sky follows Singapore time: the sun shows only by day, and after dark good air brings a crescent moon and stars, which fade as the haze thickens. With no reading Puff just sleeps, so a moon never means missing data.

## [1.11.0] - 2026-10-26

### Changed

- Puff is redrawn as a soft, volumetric cumulus cloud: shaded cloud lobes with no outline, Pixar-style eyes that blink with real eyelids, cloud-puff hands, and a body that turns warmer or greyer as the haze gets worse and picks up the panel's colour underneath.
- Visitor counts also go to Umami (cookieless), next to Cloudflare Web Analytics.

## [1.10.0] - 2026-10-26

### Changed

- Puff has a new look and comes alive: a solid, clay-like body with floating hands and feet, and its own routines for each kind of air. It hops and waves when the air is fine, fidgets and wipes its brow as it gets hazier, sighs and rubs its eyes at the worst, and nods off when there is no reading. Tap Puff for a reaction; three quick taps make it spin. With reduced motion it stays still.

## [1.9.0] - 2026-10-26

### Changed

- News is easier to read: NEA's latest haze update sits on top as its own card, older days fold away, and headlines no longer break mid-word.
- Bigger text across the site: the smallest labels and notes are now 13 to 16 px.
- The Forecast page opens with its answer in plain words (the haziest hour and its PM2.5, and the best time to go out), with the numbers still first.
- Puff is bigger, fills the space beside the verdict, and brings its weather: sun when the air is fine, drifting haze as it gets worse.

## [1.8.0] - 2026-10-26

### Added

- Puff, a small animated cloud beside the verdict on the Now page: happy when the air is fine, uneasy, worried, then crying (with a mask at the worst) as the advice gets stricter, and asleep when there is no reading.

### Changed

- Data and scheduled jobs moved to Cloudflare: the history, readings, forecast archive, accuracy scores and alert state live in a private R2 bucket instead of the repository, the jobs (forecast archive, Telegram alerts, readings capture, daily history and readings) run in the site Worker on the NEA refresh Worker's schedules instead of GitHub Actions, and the globe's history files are served from the site itself instead of jsDelivr.

### Fixed

- Map number badges on yellow, light green and orange (US AQI view) use dark text instead of unreadable white.

## [1.7.0] - 2026-10-25

### Changed

- The cigarette card has two parts. Right now: this hour's PM2.5 as cigarettes a day, so it drops as soon as the air clears (it used the 24-hour average, which stayed high for hours after a hazy night). So far today: the hours since midnight, drawn as smoked butts and one lit cigarette that burns down. "Times a normal day" also uses this hour's reading.
- Hosting moves to Cloudflare Workers (vinext), at hazelah.app (www.hazelah.app redirects to it). Visitor analytics move from Vercel Web Analytics to Cloudflare Web Analytics, and the satellite smoke picture is built with WebAssembly image codecs instead of `sharp`.
- Community sensors (OpenAQ) are hidden for now.

### Fixed

- New NEA readings now appear within a few minutes of NEA publishing them, instead of up to about 40: a Cloudflare Worker checks NEA just after each hour, refreshes the site only when there is new data, and loads the main pages so visitors get them ready-made.

## [1.6.2] - 2026-10-24

### Fixed

- When today's NEA PM2.5 request failed, the page kept yesterday's readings for 30 minutes, so the forecast, the hero's next hours and Plan your day started in the past. A build whose newest reading is over 3 hours old is now kept 1 minute, and the hero and Plan your day always start at the current hour, also on a page left open.

### Changed

- Plan your day is one card: the question, the best time, the hours with it outlined, the numbers and the caveat. Its bars are scaled to the hours shown, with NEA band I's top (55 µg/m³) marked.

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

### Changed

- Photos opens with the road cameras and webcams first.
- News counts the whole haze spell, up to two clear days apart, instead of only the last week.
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

## [0.1.0] - 2026-10-15

### Added

- First public version: a mobile-first Singapore haze tracker with live NEA PM2.5 and PSI for the five regions, and Malaysian stations from APIMS.
- PM2.5 forecast from the Copernicus CAMS model, calibrated against NEA's readings.
- Hourly archive of every forecast, scored against NEA and against two baselines, with a hazy-day hit rate.
- Plain go-out advice, shareable region links and an installable app.
- Forecast smoke map, fire counts and a wind dial, "Plan your day", NEA news timeline and 7-day PSI history.
- Feedback issue form.

[Unreleased]: https://github.com/sr33r00/haze-lah/compare/v1.11.1...HEAD
[1.11.1]: https://github.com/sr33r00/haze-lah/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/sr33r00/haze-lah/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/sr33r00/haze-lah/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/sr33r00/haze-lah/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/sr33r00/haze-lah/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/sr33r00/haze-lah/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/sr33r00/haze-lah/compare/v1.6.1...v1.6.2
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
