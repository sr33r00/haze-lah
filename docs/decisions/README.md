# Decisions

Short records of design decisions the code shows. Each one has a context, the decision and what follows from it. They are dated October 2026, when they were written down; the decisions themselves were made as the code grew.

| Record | Decision |
|---|---|
| [0001](0001-calibrate-cams-to-nea.md) | Correct the global model with local sensors and publish its error |
| [0002](0002-shared-30-minute-cache.md) | Build the data once every 30 minutes for all visitors |
| [0003](0003-publish-forecast-accuracy.md) | Archive every forecast and score it against two baselines |
| [0004](0004-history-in-the-repository.md) | Keep daily history in the repository, served by a CDN, not a database |
| [0005](0005-no-archive-of-aqicn.md) | Use AQICN data live only |
| [0006](0006-server-built-satellite-pictures.md) | Build the satellite smoke picture on the server |
| [0007](0007-browser-only-personal-data.md) | Keep location and preferences in the browser |

To add one, copy the layout of an existing record, use the next number and keep it to about 15 to 30 lines. If a decision changes, add a new record that says which one it replaces; do not rewrite the old one. Back to [docs index](../README.md).
