# Haze Lah

**Is it safe to go out?** A simple, mobile-first haze tracker for Singapore. It turns official air-quality readings, satellite fire data and an atmospheric smoke model into one clear answer, a forecast you can plan around, and the science behind it.

The site is independent and is not an official NEA service. For official advisories, see [haze.gov.sg](https://www.haze.gov.sg).

## What it shows

- **A plain answer for you.** "Go ahead", "Short outings only", "Stay indoors", based on NEA's health advisory for healthy adults, for children, the elderly and pregnant women, and for people with heart or lung conditions.
- **Live readings** of 1-hour PM2.5 and 24-hour PSI for all five regions, with "use my location".
- **What to do:** practical steps for the current level, such as closing windows, choosing a purifier, when an N95 mask helps, school measures and when to see a doctor.
- **Cigarette comparison:** today's air expressed as cigarettes, using Berkeley Earth's 22 µg/m³ per cigarette.
- **Plan your day:** the next 24 hours by advice level and the cleanest 3-hour window.
- **Next 48 hours:** measured PM2.5, the forecast with its likely range, and the uncorrected model for comparison.
- **Next 5 days:** morning, afternoon and evening outlook, the likely peak, the chance PM2.5 rises above 55 µg/m³, and the expected 24-hour PSI.
- **Smoke map:** the regional smoke forecast for the next 72 hours with fires and monitoring stations.
- **Last 7 days:** each day's peak 24-hour PSI, compared with NEA records since 2014.
- **Wind and fires:** a wind dial showing whether air comes from the fire areas, and daily hotspot counts.
- **News:** NEA haze updates, the official weather outlook and changes in the live readings, with times.
- **What is in the air:** every pollutant behind the PSI for your region.
- **Neighbours:** live Malaysian stations and modelled conditions in upwind Indonesian cities.
- **Alerts:** an optional Telegram channel posts when the 24-hour PSI band changes or NEA issues a haze update.
- **Measured accuracy:** every forecast is saved when it is made and scored against what NEA later measured.

## Data sources

| Source | Used for | Licence or terms |
|---|---|---|
| [NEA via data.gov.sg](https://data.gov.sg) | Live PM2.5, PSI and pollutant sub-indices | Singapore Open Data Licence |
| [Malaysia DOE APIMS](https://eqms.doe.gov.my/APIMS/main) | Malaysian Air Pollutant Index | Public data, attributed |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | Satellite fire detections (VIIRS) | NASA open data |
| [Copernicus CAMS via Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) | PM2.5 forecast and regional smoke map | CC BY 4.0, contains modified Copernicus information |
| [ECMWF via Open-Meteo](https://open-meteo.com) | Wind at 850 hPa and rain | CC BY 4.0 |

Reference only: [ASEAN Specialised Meteorological Centre](https://asmc.asean.org) and [MyCMAQ](https://mycmaq.met.gov.my).

## How the forecast works

1. **Baseline model.** The Copernicus CAMS global forecast (0.4° grid, about 45 km, 3-hourly) gets the timing of smoke episodes broadly right but is often far off in magnitude for peat haze.
2. **Calibration.** It is rescaled to NEA's readings over the past 48 hours (median log-ratio bias), and the current error fades out over about 12 hours, so the first hours follow what is being measured now.
3. **Uncertainty.** The likely range comes from the recent spread of errors and widens with lead time. The same spread gives the chance of exceeding 55 µg/m³.
4. **PSI outlook.** The 24-hour PSI is computed from a rolling 24-hour mean of PM2.5 using NEA's sub-index breakpoints.

Advice follows NEA's guidance: 1-hour PM2.5 for what to do right now, and the 24-hour PSI for planning ahead.

### Verification

A scheduled GitHub Actions job (`.github/workflows/archive.yml`) saves each forecast as issued to `data/archive/` and writes `data/accuracy.json`. Scores are reported at 6, 24, 48, 72 and 96 hours ahead against two baselines, the raw model and "no change":

- mean absolute error, RMSE and bias in µg/m³
- precision and recall for PM2.5 above 55 µg/m³
- a hazy-day hit rate for forecasts made at 11 pm the night before

The archive is open, so anyone can reproduce the scores. It is also the training set for a learned correction model once it covers enough haze episodes.

## Running locally

Requires Node.js 20 or newer.

```bash
npm install
HAZE_MOCK=1 npm run dev   # demo data, no network or keys needed
npm run dev               # live data
```

Open http://localhost:3000. All data is also available as JSON at `/api/haze`, and the regional smoke grid at `/api/smoke`.

### Configuration

All variables are optional. Copy `.env.example` to `.env.local` to set them.

| Variable | Purpose |
|---|---|
| `FIRMS_MAP_KEY` | Free [NASA FIRMS key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) for fire counts and the fire map |
| `WAQI_TOKEN` | Free [WAQI token](https://aqicn.org/data-platform/token) for community air sensors on the map |
| `DATA_GOV_SG_API_KEY` | data.gov.sg key for higher rate limits |
| `HAZE_MOCK` | `1` renders synthetic demo data |
| `NEXT_PUBLIC_ALERTS_URL` | Telegram channel link (`https://t.me/...`) for the "Get alerts" button |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot and channel used by `scripts/alert.ts` |
| `SITE_URL` | Site link in alert messages |

## Project structure

```
src/lib/sources/   one module per data provider
src/lib/forecast.ts   calibration, likely range and daily outlook
src/lib/bands.ts      NEA bands, PSI sub-index and health advisory
src/lib/advice.ts     practical steps by level and group
src/lib/accuracy.ts   forecast verification
src/components/       page sections
scripts/              archive, scoring and alert jobs
```

## Contributing

Issues and pull requests are welcome. Please keep the interface simple, cite a source for any health or scientific claim, and run `npx tsc --noEmit` and `npm run lint` before opening a pull request. Report security issues as described in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE). Data remains under the licences of its providers listed above.
