import { getReplay, REPLAY_KEY } from "../replayData";
import { getSmoke, SMOKE_KEY } from "../smokeData";
import { storeBuilt } from "../stored";

// The hourly job keeps the costly API answers ready in the bucket, so that /api/replay, /api/smoke, /map and /air-journey read them instead of rebuilding them in every data centre.

/** Builds the replay (wind frames and fires) and stores it as `replay-latest.json`. */
export const storeReplay = () => storeBuilt(REPLAY_KEY, getReplay);

/** Builds the smoke grid (Open-Meteo) and stores it as `smoke-latest.json`. */
export const storeSmoke = () => storeBuilt(SMOKE_KEY, getSmoke);
