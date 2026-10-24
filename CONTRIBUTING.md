# Contributing to Haze Lah

Thank you for helping. Haze Lah is a free haze tracker for Singapore, run by one person. Small, careful changes are easiest to review.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, follow [SECURITY.md](SECURITY.md) and do not open a public issue.

## Before you start

- For a bug or a wrong number, open an issue with the bug report form. For an idea, use the feature request form.
- For anything bigger than a small fix, open an issue first so we can agree on the approach before you write code.
- To see how the code is laid out, read [docs/architecture.md](docs/architecture.md) and [docs/development.md](docs/development.md).

## Set up

Follow the [Quick start in the README](README.md#quick-start). `HAZE_MOCK=1 npm run dev` gives demo data with no network and no keys. Optional keys are in the [Configuration table](README.md#configuration).

## Branch and pull request

1. Fork the repository and create a branch from `main`.
2. Make one focused change. Keep unrelated clean-ups for another pull request.
3. Run the checks below.
4. Open a pull request against `main` and fill in the template. The owner reviews every pull request.

## Checks before a pull request

```bash
npx tsc --noEmit
npm run lint
npm test
```

Then look at your change in a browser at phone width (390 px) and at desktop width, in both light and dark themes. For a user-facing change, add screenshots to the pull request.

## Code style

- Match the surrounding code. Give exported functions and types a short doc comment.
- Use the existing Tailwind tokens (`bg-surface`, `text-muted`, `text-accent`, `tabular`) and the shared components in `src/components/ui.tsx` instead of new colours or one-off styles.
- Keep the interface simple, with little text and no emojis. It must work on a phone first, and also use the space on a laptop. Use real buttons, labels on icon buttons, `aria-pressed` on toggles and 44 px hit targets, and respect reduced motion.
- Do not repeat yourself. A control, label or link appears once per page, and a helper exists once. Before adding one, search for it. Shared strings and links live in `src/lib/links.ts`, date and time formatting in `src/lib/format.ts`, and dates, Singapore time and fetch helpers in `src/lib/util.ts`.

## Science and health claims

Every health or science claim on the site cites an official or published source. Advice follows NEA: the 1-hour PM2.5 for what to do now, and the 24-hour PSI for planning ahead. If your change adds or alters a claim, put the source in the code next to it and in the pull request.

## Third-party data

Each provider has terms. Keep the attribution each one requires (see the [data sources table](README.md#data-sources)).

- AQICN (waqi.info) station data is read only while building the page data. Never write it to `data/`, an archive or any script output, and keep its credit line wherever it is shown.
- Windy webcam images are used exactly as provided, and each links to its Windy page.
- Add any new image or connect host to the Content-Security-Policy in `next.config.ts`.
- Never commit a key or token. Keys belong in `.env.local`, which is git-ignored. `.env.example` lists the variables.

## Commit messages

Write a short summary that starts with the area, then what changed:

```text
Forecast: 5-day strips never look safer than the day's PSI
Photos: cameras first
```

Add a few lines of explanation when the reason is not obvious. Commits by the archive jobs start with `data:`.

## Licence of contributions

Haze Lah is licensed under the [GNU AGPL v3](LICENSE) with the attribution term in [NOTICE](NOTICE). By contributing, you agree that your contribution is licensed under the same terms.
