# Haze Lah: notes for coding agents

A mobile-first Singapore haze tracker (Next.js 15 App Router, TypeScript, Tailwind 4, react-leaflet, recharts, lucide-react). See the README for what it shows, its data sources and how the forecast works.

## How work is split

- **Opus** (the main session) plans, writes the spec, reviews diffs, runs the checks and talks to the user. It does not write feature code itself, beyond tiny edits already in hand.
- **Sonnet 5.5** (a general-purpose subagent with `model: "sonnet"`) writes the code. Put the design judgement into its spec. Do not use the `opus-coder` agent.
- **Haiku 5.5** (`model: "haiku"`) does broad searches of the codebase or the web.

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

## Where things are

- `src/lib/sources/`: upstream fetchers (NEA, Malaysia APIMS, NASA FIRMS, Open-Meteo CAMS/ECMWF, OpenAQ, LTA traffic, Windy, news).
- `src/lib/forecast.ts`: CAMS calibrated to NEA. `src/lib/accuracy.ts` plus `scripts/` and `.github/workflows/archive.yml` save and score forecasts.
- `src/lib/bands.ts` and `src/lib/advice.ts`: NEA bands, sub-indices and advice.
- `src/lib/wind.ts` and `src/lib/replay.ts`: the 72-hour back-trajectory of the air ("where it came from"), fires near it and the province.
- `src/lib/satellite.ts`: NASA GIBS images (true colour, OMPS aerosol index, AIRS carbon monoxide at 500 hPa, Himawari live), plus the projection onto the 1000×520 image of `SAT_BOX`.
- `next.config.ts`: CSP. Add any new image or connect host there.
