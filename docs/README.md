# Haze Lah documentation

For what the site shows, how to run it and the data licence table, start with the [README](../README.md). For pull request rules, see [CONTRIBUTING.md](../CONTRIBUTING.md).

| Page | What it covers |
|---|---|
| [architecture.md](architecture.md) | How the system fits together: data flow diagram, pages, API routes and their caching, the browser side, failure handling, security, and a map of `src/lib` and `src/components` |
| [data-sources.md](data-sources.md) | Every upstream the site calls: endpoint host, refresh time, key, what happens without it, and attribution notes, including the live-only rule for AQICN |
| [forecast.md](forecast.md) | How the forecast works: CAMS baseline, calibration, likely range, chance above 55, PSI outlook, the 48-hour instrument, and how accuracy is archived and scored |
| [data-pipelines.md](data-pipelines.md) | The scheduled jobs in the site Worker, the R2 bucket they write, the file formats, and how the browser loads history |
| [development.md](development.md) | Local setup, demo mode, tests, checks, adding a data source or a page, and code conventions |
| [decisions/](decisions/README.md) | Short records of design decisions, each with context, decision and consequences |
