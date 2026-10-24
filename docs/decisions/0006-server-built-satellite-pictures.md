# 0006: Build the satellite smoke picture on the server

Date: 2026-10. Status: accepted.

## Context

The globe shows NASA's smoke (the OMPS aerosol index). NASA GIBS serves each satellite pass only as a coloured picture, one per instrument and day. Using them directly would mean the browser fetching several large pictures per day, in NASA's colours instead of the site's. The values behind the colours are not offered as numbers by that service.

## Decision

Build one finished picture per day on the server, in `src/lib/sources/gibsTexture.ts`, and serve it from `/api/globe/[layer]`.

1. Fetch the day's passes from the two satellites and NASA's colour-map file.
2. Turn each pixel's colour back into a value with the colour map.
3. Average the passes, smooth them (Gaussian, about 1.25 degrees) without letting gaps drag the values down, and reproject to Web Mercator (2048 x 2048).
4. Colour the result with the site's own ramp (`src/lib/globe.ts`) and encode it as WebP with `sharp`.

Caching: a finished picture is kept in `unstable_cache` for 6 hours if recent and 7 days once the day is more than 2 days old. An incomplete picture (a pass failed to download) is returned but never kept, and is sent with a 5-minute CDN lifetime so it is retried soon. Response headers are in `src/app/api/globe/shared.ts`. The route allows up to 60 seconds to build.

## Consequences

- The browser downloads one picture of about 100 KB per day, in the site's colours, with smooth edges.
- The first build of a day takes seconds and uses server time; it then happens once, not per visitor.
- Colours are mapped back to the middle of each band, so the values are approximate. They are for showing smoke, not for measuring it.
- `sharp` is a runtime dependency and the route needs more time than a normal one.
- Other GIBS pictures (Himawari loop, relief, base map tiles) are not processed; the browser loads them directly.
