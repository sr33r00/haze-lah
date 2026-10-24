# Development

How to run, check and extend Haze Lah. For pull request rules, see [CONTRIBUTING.md](../CONTRIBUTING.md). For how the system fits together, see [architecture](architecture.md).

## Setup

Node.js 20 or newer (the scheduled jobs run on Node 22).

```bash
npm install
HAZE_MOCK=1 npm run dev   # demo data, no network or keys
npm run dev               # live data
```

Open http://localhost:3000.

- **Demo mode.** `HAZE_MOCK=1` makes `getHazeData` build synthetic data from `src/lib/mock.ts` (`mockInputs`, `mockGrid`, `mockReplay`). It never touches the network and is never cached. The app shows a "Demo data" banner. Camera lists return empty in demo mode.
- **Live mode.** Copy `.env.example` to `.env.local` and fill in what you want. Every variable is optional. The README lists what each key is for; [data sources](data-sources.md) says what is lost without each one. `.env.local` is git-ignored: never put a key in a tracked file.

Without keys, live mode still shows NEA readings, the forecast, wind, news and the open-feed traffic cameras. Fires, community sensors, AQICN stations and webcams need their keys.

## Scripts

From `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint (`next/core-web-vitals` and `next/typescript`) |
| `npm test` | Runs `tsx --test "src/**/*.test.ts"` |

The scheduled-job scripts in `scripts/` are run with `npx tsx scripts/<name>.ts`; see [data pipelines](data-pipelines.md). They write into `data/`, so run them only when you mean to, and do not commit the result unless you are the one updating that data.

## Tests

Tests use Node's built-in test runner through `tsx` and sit next to the code as `src/**/*.test.ts`. They cover the pure logic: forecast hours, history and readings formats, wind and replay maths, timeline moves, source parsers (`openmeteo`, `firms`, `firmsCsv`, `waqi`) and the globe helpers. They need no network.

```bash
npm test                                          # everything
npx tsx --test src/lib/forecastHours.test.ts      # one file
```

Put a new test beside the file it checks. Prefer testing the pure function (a parser, a builder, a formatter) over a component.

## Type-check and lint

Run both before you commit:

```bash
npx tsc --noEmit
npm run lint
```

## Checking the interface

The interface is mobile first, and it must also use the room on a laptop or large monitor. Before you call a UI change done, look at it:

- at 390 px wide (a phone) and at a desktop width,
- in light and in dark theme (the toggle is in the header; the `/map` globe is dark in both),
- with the keyboard, and with reduced motion on.

Headless Chrome or Playwright against `HAZE_MOCK=1 npm run dev` is enough. Stop any dev server you start.

## Adding a data source

1. **Fetcher.** Add `src/lib/sources/<name>.ts` that returns plain, typed data. Use `getJson` or `getText` from `src/lib/util.ts` (timeout, one retry, `429` handling, a User-Agent). Pass `revalidate` only if the source is read outside the 30-minute build. Read any key with `process.env` there and nowhere else. Return an empty result when the key is missing, as the other fetchers do.
2. **Types.** Add the output type to `src/lib/types.ts` and a field on `HazeData` and `Inputs` (`src/lib/data.ts`).
3. **Wire it in.** Add the fetcher to the `Promise.allSettled` list in `fetchInputs` and read it with `settled(result, "Label", errors)`. The label is what visitors see in the footer if the source fails, so make it plain. Give it a mock value in `src/lib/mock.ts`.
4. **CSP.** If the browser loads anything from a new host (images, tiles, fetches), add the host to `img-src` or `connect-src` in `next.config.ts`. A server-only call needs nothing.
5. **Attribution.** Add a row to the data sources table in [README.md](../README.md), an entry in `SOURCE_GROUPS` in `src/app/about/page.tsx`, and the credit wherever the data is shown. Check the source's terms first. If the terms forbid storing or redistributing the data (as AQICN's do), keep it out of `data/`, archives and script output. Put shared names and links in `src/lib/links.ts`.
6. **Docs.** Add the source to [data sources](data-sources.md), and its key (name only) to `.env.example`.
7. **Test.** Add a test for the parser or filter using a small sample of the real response (see `src/lib/sources/waqi.test.ts`).

## Adding a page

1. Create `src/app/<route>/page.tsx` as a server component. Set `export const metadata = pageMeta(title, description, "/route")` (`src/lib/seo.ts`) and `export const revalidate = 1800` so it shares the 30-minute rhythm. Call `getHazeData()` if you need data.
2. Wrap the content in `AppShell` (`src/components/AppShell.tsx`) with a `title`. Pass `data` to get the "updated" label. Put interactive parts in a client component (`"use client"`).
3. Add a `loading.tsx` if the page waits on data (see `src/app/news/loading.tsx`).
4. Add the route to the navigation in `src/components/BottomNav.tsx`, to `PAGES` in `src/app/sitemap.ts`, and to the page list in `src/app/llms.txt/route.ts`.
5. Check it at 390 px and on a desktop, in light and dark.

## Conventions

- **One place for each thing.** A control, label or link appears once per page. A helper exists once. Search the code before you add a string or function.
  - Shared strings and links: `src/lib/links.ts`.
  - Dates and times: `src/lib/format.ts` (`fmtHour`, `fmtWeekday`, `fmtDate`, `fmtDay`, and others) and `src/lib/util.ts` (`sgDate`, `sgHour`, `sgtTime`, `shiftDate`). All dates are Singapore time (UTC+8).
  - Saved settings in the browser: `useStored` in `src/components/usePrefs.ts`.
- **Tailwind tokens.** Use the theme colours `bg-surface`, `text-muted`, `bg-line`, `text-accent`, `bg-bg`, `text-fg` (defined in `src/app/globals.css`, with light and dark values), and `tabular` for numbers that change. Do not hard-code colours that have a token.
- **Components.** Use `Section` and the other primitives in `src/components/ui.tsx`, and `InfoNote` (`src/components/InfoNote.tsx`) for a short line with a "more information" button.
- **Accessibility.** Real buttons; `aria-pressed` on toggles; labels on icon-only buttons; 44 px touch targets; `aria-live` on captions that change; respect reduced motion; avoid layout shift.
- **Health and science claims** cite an official or published source. Advice follows NEA: 1-hour PM2.5 for now, 24-hour PSI for planning ([forecast](forecast.md#the-advice-rule)).
- **Third-party terms.** Keep the attribution each source requires. Windy images are used exactly as given and link to their webcam page. AQICN data is live only ([data sources](data-sources.md#aqicn-waqiinfo)).
- **Code style.** Match the code around you: short doc comments on exports, plain names. Plain English and British spelling in text.
- **Secrets.** Keys live in `.env.local` and in the repository's Actions secrets. Never put one in a tracked file, a commit or an issue.
