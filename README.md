# Haze SG

A mobile-first Singapore haze tracker: live levels, a 5-day forecast and a plain answer to "is it safe to go out?", based on NEA's official health advisory.

## Data

| Source | Used for |
|---|---|
| NEA via data.gov.sg | Live 1-hr PM2.5 and 24-hr PSI, 5 regions |
| Malaysia DOE APIMS | Live API for Johor, Melaka and other nearby stations |
| NASA FIRMS (VIIRS) | Fire hotspots in Sumatra and Borneo (needs `FIRMS_MAP_KEY`) |
| Copernicus CAMS via Open-Meteo | PM2.5 forecast; model estimates for upwind Indonesian cities |
| ECMWF via Open-Meteo | Wind at 850 hPa and rain |

## Forecast

CAMS PM2.5 is calibrated against NEA's last 48 h of readings (median log-ratio bias correction, current error decaying over about 12 h, uncertainty band from recent residuals). The daily PSI outlook applies NEA's PM2.5 sub-index breakpoints to a rolling 24-h mean. See `src/lib/forecast.ts`.

## Develop

```bash
npm install
HAZE_MOCK=1 npm run dev   # demo data, no network needed
npm run dev               # live data
```

`GET /api/haze` returns everything as JSON.

## Deploy

Import the repo at vercel.com/new, add `FIRMS_MAP_KEY` as an environment variable, and deploy. Pages revalidate every 5 minutes.

## Forecast verification

`.github/workflows/archive.yml` runs hourly: `scripts/archive.ts` saves the forecast as issued to `data/archive/YYYY-MM.jsonl`, and `scripts/score.ts` writes `data/accuracy.json` (MAE, RMSE and bias at 6/24/48/72/96 h for this site, raw CAMS and persistence, plus precision/recall for PM2.5 > 55 µg/m³). The site reads that file from GitHub, and `vercel.json` skips redeploys for data-only commits. The archive is also the training set for a future learned correction (e.g. XGBoost) once it covers enough haze episodes.
