import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };
import { SCHEDULES } from "./src/schedule.ts";

/** Watches NEA's PM2.5 feed and tells the Haze Lah site to refresh only when NEA has new data. Also starts the site's scheduled jobs. */
export default defineConfig({
  worker: {
    name: "haze-lah-nea-refresh",
    entrypoint,
    compatibilityDate: "2026-10-24",
    // No public URL: it runs only on these schedules (UTC), listed with what each does in src/schedule.ts. The NEA check runs at minutes
    // 2, 5, 10 and 20: NEA posts a new hour about 30 s after the hour, and once that hour is in, the later checks exit without calling NEA.
    // The other schedules start the site's jobs (hourly safety net, daily history and readings).
    workersDev: false,
    triggers: SCHEDULES.map((schedule) => triggers.scheduled({ schedule })),
    env: {
      // The newest NEA reading the site has already been told about.
      STATE: bindings.kv({ id: "510a5a1f23a34e18bd2b20d3ddca4b37" }),
      SITE_URL: bindings.text("https://hazelah.app"),
      REFRESH_SECRET: bindings.secret(),
      // data.gov.sg API key, the same as the site Worker's.
      DATA_GOV_SG_API_KEY: bindings.secret(),
    },
    observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true } },
  },
});
