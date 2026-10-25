import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

/** Watches NEA's PM2.5 feed and tells the Haze Lah site to refresh only when NEA has new data. */
export default defineConfig({
  worker: {
    name: "haze-lah-nea-refresh",
    entrypoint,
    compatibilityDate: "2026-10-24",
    // No public URL: it runs only on this schedule (minutes past each hour, UTC). NEA posts a new hour about 30 s after the hour;
    // once that hour is in, the later checks of the hour exit without calling NEA.
    workersDev: false,
    triggers: [triggers.scheduled({ schedule: "2,5,10,20 * * * *" })],
    env: {
      // The newest NEA reading the site has already been told about.
      STATE: bindings.kv({ id: "510a5a1f23a34e18bd2b20d3ddca4b37" }),
      SITE_URL: bindings.text("https://hazelah.app"),
      REFRESH_SECRET: bindings.secret(),
    },
    observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true } },
  },
});
