# Security policy

Please report vulnerabilities privately through GitHub's **Report a vulnerability** button on the Security tab of this repository, not in a public issue. Include steps to reproduce and the affected page or endpoint. You can expect a first response within a few days.

## Design notes

- The site has no accounts, forms, database or user uploads. It only reads public air-quality data.
- API keys (NASA FIRMS, data.gov.sg) are read from environment variables on the server and never sent to the browser.
- Location is used only in the browser to pick the nearest region; it is never sent to the server.
- Responses carry a strict Content-Security-Policy and standard security headers (see `next.config.ts`).
- Upstream failures are reported to visitors by source name only; details stay in server logs.
