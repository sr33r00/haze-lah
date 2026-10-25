import { readJsonStrict, writeJson } from "../dataStore";
import { addToIndex, assertFires, buildDay } from "../history";
import type { HistoryIndex } from "../historyTypes";
import { fetchFiresRange } from "../sources/firms";
import { NEA_PAUSE_MS, fetchNeaDay } from "../sources/nea";
import { dayAQ, fetchHistoryAQ, fetchHistoryWind, gridQuery } from "../sources/openmeteo";
import { shiftDate, sleep } from "../util";
import { dayRange } from "./range";

const CHUNK_DAYS = 10; // days built from one pair of Open-Meteo requests (wind then spans 13 days, within its 14-day unit)

/** What the history step did: the days saved, and the ones that failed (`date: reason`) or other things worth a line. */
export type HistoryResult = { built: string[]; failed: string[]; notes: string[] };

/**
 * Writes the air globe's history: `history/<date>.json` for each Singapore (SGT) day from `from` to `to` (default: yesterday), and
 * `history/index.json`. Sources: NASA FIRMS fires (FIRMS_MAP_KEY), Open-Meteo CAMS air quality and the historical-forecast archive for the
 * 850 hPa wind, and NEA's dated feeds on data.gov.sg (DATA_GOV_SG_API_KEY if set). Days are built a chunk at a time to keep the Open-Meteo
 * request count low, and NEA is read gently (one day at a time, with a pause).
 *
 * FIRMS product: the live pages use VIIRS_SNPP_NRT (near real time, which FIRMS keeps for recent months only). For a date it no longer
 * holds, the request falls back to the standard-processing product VIIRS_SNPP_SP (FIRMS_SOURCE changes the pair) and `notes` says so.
 *
 * A day with no fires at all in the three areas fails (the region always has some, so 0 means FIRMS has no data for it yet), and so
 * does a FIRMS window that comes back empty from both products. The other days are still written; run the failed ones again.
 */
export async function buildHistory(from: string | null, to: string | null): Promise<HistoryResult> {
  const dates = dayRange(from, to);
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) throw new Error("FIRMS_MAP_KEY is not set, so no day has fires and every day would fail its fire check");

  let index = (await readJsonStrict<HistoryIndex>("history/index.json")) ?? { updated: "", days: [] };
  const { lats, lons } = gridQuery();
  const result: HistoryResult = { built: [], failed: [], notes: [] };

  for (let c = 0; c < dates.length; c += CHUNK_DAYS) {
    const chunk = dates.slice(c, c + CHUNK_DAYS);
    const first = chunk[0];
    const last = chunk.at(-1)!;
    let shared;
    try {
      // An SGT day is 16:00 UTC the day before to 16:00 UTC; its trail needs wind from three days before.
      const aq = await fetchHistoryAQ(shiftDate(first, -1), last);
      const frames = await fetchHistoryWind(shiftDate(first, -3), last);
      const fires = await fetchFiresRange(key, shiftDate(first, -1), last, (m) => result.notes.push(m));
      shared = { aq, frames, fires };
    } catch (e) {
      result.failed.push(...chunk.map((d) => `${d}: ${e instanceof Error ? e.message : e}`));
      continue;
    }
    for (const date of chunk) {
      try {
        const nea = await fetchNeaDay(date);
        const day = assertFires(buildDay({ date, fires: shared.fires, frames: shared.frames, aq: dayAQ(shared.aq, lats, lons, date), nea }));
        await writeJson(`history/${date}.json`, day);
        index = addToIndex(index, day);
        await writeJson("history/index.json", index);
        result.built.push(date);
      } catch (e) {
        result.failed.push(`${date}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(NEA_PAUSE_MS);
    }
  }
  return result;
}
