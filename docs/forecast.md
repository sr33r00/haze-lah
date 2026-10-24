# How the forecast works

The forecast takes a global air-quality model, corrects it with what NEA's monitors measured in the last two days, and gives a number, a likely range and a chance of going above the "Normal" limit. Every forecast is saved when it is made and scored later against what NEA measured, and the scores are published.

Code: `src/lib/forecast.ts`, `src/lib/forecastHours.ts`, `src/lib/accuracy.ts`, `src/lib/bands.ts`. Archive and scoring jobs: `scripts/archive.ts`, `scripts/score.ts`, `.github/workflows/archive.yml` (see [data pipelines](data-pipelines.md)). The decisions behind it: [ADR 0001](decisions/0001-calibrate-cams-to-nea.md) and [ADR 0003](decisions/0003-publish-forecast-accuracy.md).

## The advice rule

Advice follows NEA's own guidance.

- **Now:** use the latest **1-hour PM2.5** reading and NEA's personal guide for the bands. This is what `adviceStep` in `src/lib/bands.ts` does. The 24-hour PSI is used for "now" only when there is no PM2.5 reading.
- **Planning ahead:** use the **24-hour PSI**, which is what NEA's forecast and advisories use for the next day.

The forecast therefore produces both: hourly PM2.5 (for the next hours) and a daily peak PSI (for the next days).

NEA sources already cited in the code and on the About page: the [PSI and PM2.5 guide](https://www.haze.gov.sg/docs/default-source/posters/haze-pm-psi-guide-a4-english.pdf), [Computation of the PSI](https://www.haze.gov.sg/docs/default-source/faq/computation-of-the-pollutant-standards-index-(psi).pdf) (`NEA_PSI_URL` in `src/lib/links.ts`) and [haze.gov.sg](https://www.haze.gov.sg).

## 1. The baseline: Copernicus CAMS

`fetchCamsSingapore` in `src/lib/sources/openmeteo.ts` reads the CAMS global PM2.5 forecast for Singapore through Open-Meteo: 2 past days and 5 forecast days, hourly. The grid is about 0.4 degrees (roughly 45 km), the model output is 3-hourly and Open-Meteo interpolates it to hourly. `FORECAST_METHOD` in `forecast.ts` is the one-paragraph description shown on the About page.

CAMS gets the timing of smoke episodes broadly right but is often far off in size for peat haze. In the scores published so far (`data/accuracy.json`) the raw CAMS bias is negative at every lead time: it under-predicts. That is why the next step exists.

## 2. Calibration

`buildForecast(obs, cams, hours = 120)` in `src/lib/forecast.ts`. `obs` is NEA's island-mean 1-hour PM2.5 (the mean of the five regions, built in `fetchNeaPm25History`).

1. **Pair** each NEA hour with the CAMS value for the same hour. CAMS values are floored at 3 µg/m³. Keep the last 48 pairs. With fewer than 6 pairs there is no forecast (`null`).
2. **Bias.** Take the log of observed divided by CAMS for the last 24 pairs. The bias is the exponential of the median, limited to the range 0.3 to 6. It is a multiplier: a bias of 2 means NEA reads about twice what CAMS says.
3. **Sigma.** The residuals are the log ratios minus the log of the bias. `sigma` is their root-mean-square, never below 0.2. It is the typical error in log terms: `e^sigma - 1` is the typical relative error.
4. **Current anomaly.** The last NEA reading divided by what the corrected model said for that hour, limited to 0.25 to 4.
5. **Each forecast hour h (1 to 120 hours after the last reading, only where CAMS has the hour):**

   ```
   estimate = CAMS x bias x anomaly ^ exp(-h / 12)
   ```

   The anomaly term fades out with a time constant of 12 hours: right now the forecast sticks close to the latest reading (persistence is very good for the first hours), and after a day or so it is the bias-corrected model alone.

The values are published as `HazeData.forecast`: `biasFactor`, `sigma`, `hourly` (a `ForecastPoint` per hour with `pm25`, `low`, `high`, `raw`, `pHigh`) and `days`.

## 3. Likely range and chance above 55

The errors are treated as log-normal, so the range is multiplicative and never negative.

```
s    = sigma x min(1, 0.35 + h / 12) x sqrt(1 + h / 48)
low  = estimate x exp(-s)
high = estimate x exp(+s)
```

- The first factor makes the range narrow at short lead times (it reaches the full sigma after about 8 hours).
- The second makes it widen with lead time (about 1.4 times wider at 48 hours).
- `low` to `high` is one standard deviation on the log scale, so it is the typical range, not a guarantee.
- `pHigh` is the chance that PM2.5 is above 55 µg/m³ (`HIGH_PM25`, the top of NEA's Band I, "Normal"): `1 - Phi((ln 55 - ln estimate) / s)`, where `Phi` is the standard normal distribution (`phi` in the same file). It is rounded to two decimals and shown as a percentage.

## 4. PSI outlook from rolling 24-hour PM2.5

NEA's PSI is a 24-hour measure. `dailyOutlook(obs, fc, weather, days = 5)` builds one entry per Singapore day:

1. Join the observations and the forecast hours into one hourly series.
2. For each hour in the day, take the mean PM2.5 of the 24 hours up to and including it (at least 18 points are needed), and convert it with `pm25ToPsi` in `src/lib/bands.ts`.
3. `psiMax` is the highest of those values in the day.

`pm25ToPsi` uses NEA's published PM2.5 breakpoints with linear interpolation between them:

| 24-hour PM2.5 (µg/m³) | PSI |
|---|---|
| 0 to 12 | 0 to 50 |
| 12 to 55 | 50 to 100 |
| 55 to 150 | 100 to 200 |
| 150 to 250 | 200 to 300 |
| 250 to 350 | 300 to 400 |
| 350 to 500 | 400 to 500 |

During haze, PM2.5 almost always sets the PSI, so this stands in for the full PSI. It does not model the other pollutants. `psiLevel` maps a PSI to NEA's descriptors: Good up to 50, Moderate to 100, Unhealthy to 200, Very unhealthy to 300, Hazardous above.

Each `DayOutlook` also holds:

| Field | Meaning |
|---|---|
| `pm25Max` | Highest hourly PM2.5 (observed or forecast) in the day |
| `low`, `high` | The highest `low` and highest `high` of the day's hours |
| `pHigh` | The highest chance above 55 of any hour (an observed hour above 55 counts as 1) |
| `parts` | Mean PM2.5 for morning (06 to 12), afternoon (12 to 18) and evening (18 to 24) |
| `rainProb`, `rainMm`, `gustMax` | From the ECMWF weather forecast: highest rain chance, total rain, strongest gust |

Days with no PSI result are skipped. The Now page's "is it getting better" line (`hazeTrend` in `src/lib/trend.ts`) reads these days.

## 5. The 48-hour instrument

The forecast page shows an "instrument": one hourly axis with the last measured hours, the next 48 forecast hours, rain chance and wind. `src/lib/forecastHours.ts` builds it.

| Function | What it does |
|---|---|
| `instrumentHours` | Joins the last 12 measured hours, the first 48 forecast hours, the rain chance and the 3-hourly wind outlook into one sorted list of `InstrumentHour` |
| `peakAhead` | The highest forecast hour, ignoring measured-only hours |
| `bestWindow` | The best stretch of daylight (07:00 to 19:00 Singapore time): the run of at least 3 consecutive forecast hours, all at or under 55 µg/m³, with the lowest maximum (the earliest on a tie), widened to neighbouring daylight hours that stay at or under that maximum. Null if no run qualifies |
| `answerText` | The headline and detail sentences at the top of the page |
| `readoutLines`, `readoutText` | The text for one hour: time, PM2.5 with range, chance above 55, the model value, wind, fires on the way, rain |

`answerText` picks the headline like this:

- "Worst right now, near N" when the latest measured value is above 55 and at least the forecast peak.
- "Normal air for the next 48 hours." when the whole forecast stays at or under 55 (the detail then names the highest hour and the best window).
- Otherwise "Worst <day> around <hour>, near N".

The detail adds the best window, or "No clear window in the next 48 hours", and ends with a short-lead clause when the scores say so (see below).

Wind and fires on the instrument come from the browser-side replay (`fetchReplay`), so the instrument still works without them. The Now page's "Plan your day" (and the alert's best time out) uses `bestSlots` in `src/lib/exercise.ts`: the session whose worst likely hour (highest forecast `high`) is lowest.

## 6. The 5-day outlook

The 5-day outlook is the `days` array from section 4. `Outlook.tsx` draws it on the forecast page ("Next 5 days", with rain and gusts) and `HazeOutlook.tsx` draws a colour strip and a one-line trend on the Now page. CAMS forecasts go out 5 days, so the later days are wider and less reliable; the range widening in section 3 reflects that. The past 7 days of measured peak PSI (`PsiWeek.tsx`) sit beside it for context.

## 7. Verification

Every hour, `scripts/archive.ts` saves the forecast as issued, and `scripts/score.ts` scores everything saved so far.

**Archive.** One JSON line per forecast in `data/archive/YYYY-MM.jsonl` (`ArchiveRecord` in `accuracy.ts`):

| Field | Meaning |
|---|---|
| `issued` | Time of the last NEA reading used |
| `retrieved` | When the data was built |
| `obs` | The last 24 hours of NEA island-mean PM2.5 |
| `fc` | `[lead hours, our value, raw CAMS value]` for leads 1 to 96 |
| `bias` | The bias multiplier used |
| `fires` | Fire counts for Sumatra and Borneo, or null |
| `errors` | Sources that failed at that moment |

**Scoring.** `scoreArchive` in `src/lib/accuracy.ts` builds one table of NEA observations from all records. For each lead time in `LEADS` (6, 24, 48, 72 and 96 hours) and each record, it compares three forecasts with the NEA value measured `lead` hours after `issued`:

- **ours**: the corrected forecast,
- **cams**: the raw CAMS value,
- **persistence**: the NEA value at issue time ("same as now").

For each it keeps `n` (matched forecasts), `mae` (mean absolute error), `rmse` and `bias` (forecast minus observed), all in µg/m³ to one decimal. An `event` score treats "PM2.5 above 55" as the event and reports `precision`, `recall` and `f1`. `hazyDays` scores the night-before call: the forecast issued closest to 23:00 Singapore time (from 21:00 on) against the next day's observed peak, counting `hits` and `clearRight` days for ours and for persistence, out of `days` with `hazy` ones.

**Output.** `data/accuracy.json` holds `updated`, `forecasts`, `from`, `to`, `leads` and `hazyDays`. The site reads it from GitHub's raw host (`fetchAccuracy`, kept for an hour) and ignores it until some lead has at least 20 matched forecasts (the About page accepts 1).

**What the site says about it.**

- `skillRows` keeps leads with at least 20 forecasts and all three errors.
- `skillSentence` says where the forecast starts to beat both CAMS and "same as now".
- `shortLeadNote` adds "For the next N hours, today's reading is the better guide" (or "Copernicus alone is closer") when the forecast loses at short leads.

Forecasts are estimates and can be wrong, especially when the wind shifts or fires flare up. The archive is public, so anyone can reproduce the scores.
