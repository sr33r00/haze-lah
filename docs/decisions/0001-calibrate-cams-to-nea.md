# 0001: Calibrate CAMS to NEA and publish its error

Date: 2026-10. Status: accepted.

## Context

The forecast starts from the Copernicus CAMS global model, which the site reads free through Open-Meteo and which reaches 5 days ahead. It runs on a grid about 45 km wide. It gets the timing of smoke episodes broadly right but is often far off in size for peat haze. Singapore's own monitors (NEA, through data.gov.sg) report the real 1-hour PM2.5 every hour. Advice here follows NEA, so the numbers should be comparable with NEA's.

## Decision

Treat CAMS as a shape, not an answer. `buildForecast` (`src/lib/forecast.ts`) rescales it with a multiplicative bias taken from the last 24 matched hours of NEA data. It also lets the current error fade out over about 12 hours, so the first hours stay close to the latest reading. The likely range comes from the typical recent error and widens with lead time. The chance of going above 55 µg/m³ follows from the same log-normal error.

The raw CAMS value is kept beside ours (`raw` on each forecast point) and shown as the model's own number. The method is described in plain words on the About page (`FORECAST_METHOD`), and the bias and sigma are exposed in the page data.

Details: [forecast](../forecast.md).

## Consequences

- The forecast is usually closer to NEA than raw CAMS. [ADR 0003](0003-publish-forecast-accuracy.md) measures that rather than assuming it.
- It needs NEA history. With fewer than 6 matched hours there is no forecast, and the site says so.
- A bias fitted to the last day can be wrong when conditions change quickly. That is why the range exists and why short leads sometimes lose to "same as now". The site says so when the scores show it.
- The correction is simple and explainable. A learned model is possible later, trained on the public archive.
