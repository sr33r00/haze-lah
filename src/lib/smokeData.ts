import { mockGrid } from "./mock";
import { fetchSmokeGrid } from "./sources/openmeteo";
import { LAST_GOOD_MS, storedText } from "./stored";
import { readWind } from "./windData";

/** Where the hourly job stores the smoke grid. The upstream model changes every 3 hours; readers keep a failed rebuild's last good copy for a day. */
export const SMOKE_KEY = "smoke-latest.json";

/** The smoke forecast grid: CAMS from Open-Meteo and the stored wind (no wind when there is none; the hourly job and the fallback of `smokeText`). */
export const getSmoke = async () => (process.env.HAZE_MOCK === "1" ? mockGrid() : fetchSmokeGrid(await readWind().catch(() => null)));

/** The smoke grid as JSON text for /api/smoke: the job's stored copy while it is at most a day old, else built now. */
export const smokeText = () => storedText(SMOKE_KEY, LAST_GOOD_MS, getSmoke);
