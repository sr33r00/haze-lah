# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Report a vulnerability** button on the Security tab of this repository, not in a public issue. Include steps to reproduce and the affected page or endpoint. You can expect a first response within a few days.

To report a conduct problem instead, see the [Code of Conduct](CODE_OF_CONDUCT.md).

## Supported versions

Only the latest version on `main` (the live site) is supported. Fixes are made there.

## Design notes

- The site has no accounts, no database and no user uploads. It reads public air-quality data.
- The one form is the feedback form. It posts to `/api/feedback`, which limits each IP address to a few messages every ten minutes, caps the length of every field, ignores a hidden bot-trap field, and forwards the message as plain text to the owner. Nothing is stored on the site.
- Every API key (NASA FIRMS, data.gov.sg, OpenAQ, AQICN, LTA DataMall, Windy, Resend and Telegram) is a server-side environment variable. None is sent to the browser, and none is in the repository. `.env.example` lists the names only.
- Location is used only in the browser to pick the nearest region; it is never sent to the server.
- Responses carry a strict Content-Security-Policy and other security headers: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, a `Referrer-Policy` and a `Permissions-Policy`. They are set in `next.config.ts`, and each external host the page may load from is listed there.
- Upstream failures are reported to visitors by source name only; details stay in server logs.
