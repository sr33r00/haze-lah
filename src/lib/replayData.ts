import { mockReplay } from "./mock";
import { buildReplay } from "./replay";
import { fetchFirePoints } from "./sources/firms";
import { storedJson, storedText } from "./stored";
import type { Replay } from "./types";
import { readWind } from "./windData";

/** The replay, built on the server from the stored wind (past and forecast) and the fires. What the hourly job stores; pages and routes read it with `readReplay` or `replayText`. */
export async function getReplay(): Promise<Replay> {
  if (process.env.HAZE_MOCK === "1") return mockReplay();
  const [wind, fires] = await Promise.all([readWind(), fetchFirePoints()]);
  return buildReplay(wind, fires ?? []);
}

/** Where the hourly job stores the replay, and how old it may be when served. */
export const REPLAY_KEY = "replay-latest.json";
const REPLAY_MAX_AGE_MS = 2 * 3600_000;

/** The replay as JSON text for /api/replay: the job's stored copy when it is recent, else built now. */
export const replayText = () => storedText(REPLAY_KEY, REPLAY_MAX_AGE_MS, getReplay);

/** The replay for pages and pictures: the job's stored copy when it is recent, else built now. */
export const readReplay = () => storedJson(REPLAY_KEY, REPLAY_MAX_AGE_MS, getReplay);
