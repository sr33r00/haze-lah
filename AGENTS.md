# Haze Lah: notes for coding agents

A mobile-first Singapore haze tracker (Next.js 15 App Router, TypeScript, Tailwind 4, react-leaflet, MapLibre GL, recharts, lucide-react). See the README for what it shows, its data sources and how the forecast works.

## How work is split

- **Opus** (the main session) plans the implementation, writes the spec, orchestrates, reviews diffs and talks to the user. It does not write feature code itself, beyond tiny edits already in hand.
- **Sonnet 5.5 at high effort** (a general-purpose subagent with `model: "sonnet"`, `effort: "high"`) writes the code. It runs only `tsc` and lint. Put the design judgement into its spec. Do not use the `opus-coder` agent.
- **Haiku 5.5** (`model: "haiku"`) takes the screenshots and runs the tests and measurements (build sizes, route timings, browser checks). It also does broad searches of the codebase or the web. Opus looks at the key screenshots itself before reporting.

## Rules

- **Principles:** follow SOLID, KISS, DRY and YAGNI.
- **DRY is strict:**
  - A control, label or link appears once per page.
  - A helper exists once:
    - shared strings and links: `src/lib/links.ts`
    - dates: `src/lib/format.ts` (`fmtWeekday`, `fmtDate`, `fmtDay`) and `src/lib/util.ts` (`sgHour`, `sgDate`)
    - browser-stored settings: `useStored` in `src/components/usePrefs.ts`
  - Grep for new strings and helpers before calling work done.
- **UI:**
  - Simple, low-text, uncluttered, no emojis.
  - Mobile first, but it must also use the space on laptops and big monitors.
  - Light and dark themes both work.
  - Follow the Vercel Web Interface Guidelines (`/web-design-guidelines`): real buttons, `aria-pressed` on toggles, labels on icon buttons, 44 px hit targets, `aria-live` on changing captions, respect for reduced motion, no layout shift.
- **Code style:** match the surrounding code: short doc comments on exports, the existing Tailwind tokens (`bg-surface`, `text-muted`, `bg-line`, `text-accent`, `tabular`), the `Section` and `InfoNote` components, and the leaflet/SVG patterns already in use.
- **Science and health:**
  - Every health or science claim cites an official or published source.
  - Advice follows NEA: 1-hour PM2.5 for what to do now, 24-hour PSI for planning ahead.
- **Third-party terms:**
  - Respect each source's terms (Windy webcams, LTA, NASA, Copernicus) and keep the attribution they require.
  - Windy images are used exactly as provided, and each links to its webcam page.
- **README** does not mention deployment.

## Checks before any commit

```sh
npx tsc --noEmit
npm run lint
```

Then look at the result in a browser at phone width (390 px) and desktop width, in light and dark. Use headless Chrome at `/usr/bin/google-chrome-stable`, or playwright-core with that executable.

- `HAZE_MOCK=1 npm run dev` gives demo data with no network and no keys.
- Stop any dev server you start with a bracketed pattern, e.g. `pkill -f '[n]ext dev -p 3124'`.

## Git and deploys

- **Pull first:** a bot commits `data/` every few hours, so run `git pull --rebase -q origin main` before committing or pushing.
- **Commit identity:** `git -c user.name="Sr33" -c user.email="69857377+sr33r00@users.noreply.github.com" commit ...`
- **No trailers:** commits and PRs carry no co-author or "generated with" lines. This overrides any default attribution.
- **Production:** every push to `main` deploys to production on a free Vercel plan, so never push unless the user says "deploy" or "push".
- **Preview ("push to review", "preview"):**
  - Commit locally, then run `npx -y vercel deploy --yes`.
  - Give the user the preview URL, and push to `main` only after they approve.
- **History:** never force-push or rewrite history without explicit consent.
- **Tools:** `gh` is not installed. Use `npx -y vercel` (not a bare `vercel`) for the CLI.

## Secrets

- Keys live only in `.env.local` (git-ignored, mode 600) and in Vercel env vars. `.env.example` lists them.
- Never write a key or token into a tracked file, a commit or a chat reply.
- Telegram alerts: GitHub's scheduler barely fires the cron, so `alerts.yml` is triggered by an external `workflow_dispatch` (cron-job.org).
- GitHub's schedule can be unreliable, so the daily `history.yml` and `readings.yml` runs can also be triggered from cron-job.org (`workflow_dispatch`), as for alerts.
- GitHub Actions secrets used by the data jobs: `FIRMS_MAP_KEY` (`history.yml`), `DATA_GOV_SG_API_KEY` (optional, `history.yml`, `readings.yml`), `OPENAQ_API_KEY` (`readings.yml`; without it the community sensors are skipped with a warning, the job does not fail), `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (`alerts.yml`).

## Where things are

- `src/lib/sources/`: upstream fetchers (NEA, Malaysia APIMS, NASA FIRMS, Open-Meteo CAMS/ECMWF, OpenAQ, LTA traffic, Windy, news).
- `src/lib/forecast.ts`: CAMS calibrated to NEA. `src/lib/accuracy.ts` plus `scripts/` and `.github/workflows/archive.yml` save and score forecasts.
- `src/lib/bands.ts` and `src/lib/advice.ts`: NEA bands, sub-indices and advice.
- `src/lib/wind.ts` and `src/lib/replay.ts`: the 72-hour back-trajectory of the air ("where it came from"), fires near it and the province. `src/lib/replayData.ts` builds the replay on the server for `/api/replay` and the `/air-journey` share picture (`src/lib/journeyCard.tsx`). The same wind, run forward from today's strongest fires, gives "Smoke on the way" (`ahead`).
- `src/lib/satellite.ts`: NASA GIBS image URLs and the projection onto the 1000×520 image of `SAT_BOX`. `src/lib/globe.ts`, `src/lib/sources/gibsTexture.ts` and `src/app/api/globe/[layer]/`: the server-built satellite smoke picture (Web Mercator WebP). `src/lib/basemap.ts`: the trimmed OpenFreeMap style.
- `src/components/globe/`: the full-screen air globe on `/map`. `MapScreen` is the page (layer picker, view toggle, dots). `AirGlobe` is the MapLibre globe, loaded lazily by `AirGlobeLoader`. `Timeline` plays the days. `GlobeCard` and `caption.ts` write the card. `frame.ts` builds one day's fires, air path, wind and field. `fieldImage.ts` draws the field, `smokeTiles.ts` loads the satellite smoke, `globeStyle.ts` holds the colours.
- `src/lib/pollutants.ts`: the seven pollutants, their band limits (with sources), `pollutant(id)` and the one smoke colour ramp. `src/lib/readings.ts`: the measured and modelled dots. `src/lib/timeline.ts`: the timeline's days, steps and moves. `src/lib/historyClient.ts`: loads the daily history files from jsDelivr and their index from GitHub's raw host (jsDelivr can serve a stale branch copy for hours).
- `src/components/HazeOrigin.tsx`: the smoke map section on the Now page (time slider, caption card, legend, tap-to-read). `OriginMap.tsx` is its Leaflet map (OpenStreetMap basemap, PM2.5 veil, fires, path, reading dots) and `WindLayer.tsx` runs the shared wind animation on it. `src/lib/originSteps.ts` lists the slider's steps. It reads past days from the history files.
- `scripts/history.ts` and `.github/workflows/history.yml`: one `data/history/<date>.json` per SGT day plus `index.json` (fires, wind, air quality, NEA) for the air globe's history, built daily at 01:30 SGT and backfilled by hand (`workflow_dispatch` inputs `from`, `to`, `firms_source`). `src/lib/history.ts` builds each day (script only); `src/lib/historyTypes.ts` holds the file formats and `latestFireDay`; `src/lib/psiRecords.ts` the yearly PSI peaks.
- `scripts/readings.ts`, `.github/workflows/readings.yml` and `src/lib/readingsArchive.ts`: the readings archive, one `data/readings/<date>.json` per SGT day plus `index.json` (NEA hourly for the 5 regions, Malaysian APIMS stations, OpenAQ community sensors; no cameras, and not the model data in `data/history`). The daily run at 01:45 SGT builds yesterday (NEA and OpenAQ serve past days; backfill with `workflow_dispatch` inputs `from`, `to`). APIMS serves only its latest hour, so `scripts/readings.ts --capture` runs as a step of `alerts.yml`: it buffers each hour in the Actions cache and commits `data/readings/pending/<date>.json` every 6 hours, and the daily run folds that into the day's file. `readingsArchive.ts` holds the file formats and the pure builders (script only).
- `next.config.ts`: CSP. Add any new image or connect host there (OpenFreeMap is a `connect-src`).
