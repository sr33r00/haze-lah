import { mockReplay } from "./mock";
import { buildReplay } from "./replay";
import { fetchFirePoints } from "./sources/firms";
import { fetchWindFrames } from "./sources/openmeteo";
import type { Replay } from "./types";

/** The replay, built on the server from the wind (past and forecast) and the fires. Used by /api/replay and the /air-journey picture. */
export async function getReplay(): Promise<Replay> {
  if (process.env.HAZE_MOCK === "1") return mockReplay();
  const [wind, fires] = await Promise.all([fetchWindFrames(), fetchFirePoints()]);
  return buildReplay(wind, fires ?? []);
}
