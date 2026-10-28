import { getReplay, REPLAY_KEY } from "../replayData";
import { getSmoke, SMOKE_KEY } from "../smokeData";
import { storeBuilt } from "../stored";
import { getWind, WIND_KEY } from "../windData";

// The hourly job keeps the costly API answers ready in the bucket, so that /api/replay, /api/smoke, /map and /air-journey read them instead of rebuilding them in every data centre.
// Open-Meteo allows 10,000 calls a day (one per grid point), so its two grids are fetched at most every 3 hours (the model runs 2 to 4 times a day): the wind once, and the
// smoke grid and the replay use that stored wind. Run `storeWind` first. A failed rebuild leaves the last good copy, which readers keep serving for a day.

/** How often the Open-Meteo grids are rebuilt at most: 3 hours, less a margin so that a job run that comes a few minutes early still rebuilds. */
const MODEL_REBUILD_MS = 3 * 3600_000 - 10 * 60_000;

/** Builds the wind frames (one Open-Meteo request, 364 calls) and stores them as `wind-latest.json`, unless the copy is under 3 hours old. */
export const storeWind = () => storeBuilt(WIND_KEY, getWind, MODEL_REBUILD_MS);

/** Builds the replay (the stored wind frames and fires: no Open-Meteo call) and stores it as `replay-latest.json`, every hour. */
export const storeReplay = () => storeBuilt(REPLAY_KEY, getReplay);

/** Builds the smoke grid (CAMS from Open-Meteo, 364 calls, and the stored wind) and stores it as `smoke-latest.json`, unless the copy is under 3 hours old. */
export const storeSmoke = () => storeBuilt(SMOKE_KEY, getSmoke, MODEL_REBUILD_MS);
