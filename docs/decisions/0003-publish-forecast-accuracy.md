# 0003: Archive every forecast and publish how well it did

Date: 2026-10. Status: accepted.

## Context

Health advice depends on the forecast, and a forecast with no track record is only a claim. A global model corrected by a simple rule ([ADR 0001](0001-calibrate-cams-to-nea.md)) might help or might not, and it may help at some lead times and not others. The honest tests are to compare it with the raw model and with the cheapest guess, "same as now".

## Decision

- Every hour `scripts/archive.ts` appends the forecast as issued (the last 24 hours of NEA data and leads 1 to 96) to `data/archive/YYYY-MM.jsonl`. Only forecast fields are stored.
- `scripts/score.ts` runs `scoreArchive` (`src/lib/accuracy.ts`) over the whole archive and writes `data/accuracy.json`. Leads are 6, 24, 48, 72 and 96 hours. For each, ours, raw CAMS and persistence get mean absolute error, RMSE and bias. "PM2.5 above 55" gets precision, recall and F1. A "hazy day" score covers the 11 pm call for the next day.
- The About page and the forecast page show the numbers. `skillSentence` and `shortLeadNote` say plainly where the forecast loses.
- The archive and the scores are committed to the public repository, so anyone can recompute them.

Details: [forecast](../forecast.md#7-verification).

## Consequences

- The site can say "from N hours ahead this beats both baselines", and also "for the next 6 hours, today's reading is the better guide", when that is what the numbers show.
- Scores are only shown once a lead has at least 20 matched forecasts (the About page accepts 1), so early numbers do not mislead.
- The repository grows by one line an hour. Monthly files keep each file small.
- Results depend on the period covered. A calm month and a haze month score differently, so read `from` and `to` beside the numbers.
- The archive is the training set for any later learned correction.
