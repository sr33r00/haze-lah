import { mockGrid } from "./mock";
import { fetchSmokeGrid } from "./sources/openmeteo";
import { storedText } from "./stored";

/** Where the hourly job stores the smoke grid, and how old it may be when served (the upstream model changes every 3 hours). */
export const SMOKE_KEY = "smoke-latest.json";
const SMOKE_MAX_AGE_MS = 4 * 3600_000;

/** The smoke forecast grid, built from Open-Meteo (the hourly job and the fallback of `smokeText`). */
export const getSmoke = () => (process.env.HAZE_MOCK === "1" ? Promise.resolve(mockGrid()) : fetchSmokeGrid());

/** The smoke grid as JSON text for /api/smoke: the job's stored copy when it is recent, else built now. */
export const smokeText = () => storedText(SMOKE_KEY, SMOKE_MAX_AGE_MS, getSmoke);
