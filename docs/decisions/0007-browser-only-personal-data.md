# 0007: Keep location and preferences in the browser

Date: 2026-10. Status: accepted.

## Context

The site gives personal advice: which region, and for which health group. It could ask for an account, or send the visitor's position to the server to pick a region. But the data is the same for everyone ([ADR 0002](0002-shared-30-minute-cache.md)), health details are sensitive, and the site promises no accounts and no cookies.

## Decision

Personal choices never leave the browser.

- **Location.** `locateMe` (`src/components/useMyPosition.ts`) uses the browser's geolocation only when the visitor asks, or silently if permission was already granted. A position outside Singapore is ignored. It is used to pick the nearest NEA region (`nearestRegion`) and to place a dot on the map. It is not sent to any server. The `Permissions-Policy` header allows geolocation for this origin only.
- **Preferences.** Region, health group, theme and "seen" markers are kept in `localStorage` through `useStored` (`src/components/usePrefs.ts`) and a few similar calls. Every read and write is wrapped in `try`/`catch`, so the page works when storage is blocked.
- **Sharing.** A `?region=` link carries only the region.
- **Pages.** The server renders the same data for everyone; the client picks what to show for the chosen region and group.

## Consequences

- There is nothing personal to leak, delete or secure on the server.
- Choices do not follow the visitor between devices.
- Region and group are not known when the page is rendered, so the first paint uses the default (the region with the highest PSI) and then switches.
- Features that would need a visitor's position on the server (for example, per-address alerts) do not fit this design. The Telegram alerts are a single public channel for the island.
- The feedback form is the one place a visitor sends text. It goes to the owner privately and is not stored by the site ([architecture](../architecture.md#security)).
