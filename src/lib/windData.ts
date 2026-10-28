import { mockWind } from "./mock";
import { fetchWindFrames } from "./sources/openmeteo";
import { LAST_GOOD_MS, storedJson } from "./stored";
import type { WindFrame } from "./wind";

/** Where the hourly job stores the wind frames (one Open-Meteo request for the replay and the smoke grid), and how old they may be when used. */
export const WIND_KEY = "wind-latest.json";

/** The 850 hPa wind frames over the grid, built from Open-Meteo (the job step and the fallback of `readWind`). */
export const getWind = (): Promise<WindFrame[]> => (process.env.HAZE_MOCK === "1" ? Promise.resolve(mockWind()) : fetchWindFrames());

/** The wind frames for the replay and the smoke grid: the job's stored copy while it is at most a day old, else built now. */
export const readWind = () => storedJson(WIND_KEY, LAST_GOOD_MS, getWind);
