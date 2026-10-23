// Writes the air globe's history: data/history/<date>.json for each Singapore (SGT) day, and data/history/index.json.
//
//   npx tsx scripts/history.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]     (default: yesterday, SGT)
//
// Sources: NASA FIRMS fires (FIRMS_MAP_KEY; without it every day fails the fire check), Open-Meteo CAMS air quality and the
// historical-forecast archive for the 850 hPa wind, and NEA's dated feeds on data.gov.sg (DATA_GOV_SG_API_KEY if set). Days are built a chunk at a time to keep the Open-Meteo request count low,
// and NEA is read gently (one day at a time, with a pause).
//
// FIRMS product: the live pages use VIIRS_SNPP_NRT (near real time, which FIRMS keeps for recent months only). For a date it
// no longer holds, the request falls back to the standard-processing product VIIRS_SNPP_SP (FIRMS_SOURCE changes the pair)
// and the log says so. The product is therefore decided when the owner runs the backfill, and it should be recorded here:
//   backfill product: NOT YET CONFIRMED (the key lives in GitHub Actions, not on a development machine).
//
// A day with no fires at all in the three areas fails (the region always has some, so 0 means FIRMS has no data for it yet), and so
// does a FIRMS window that comes back empty from both products. Exits non-zero if any day failed, after writing the others.
// Re-run just those days with --from/--to.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { addToIndex, assertFires, buildDay } from "../src/lib/history";
import type { HistoryIndex } from "../src/lib/historyTypes";
import { fetchFiresRange } from "../src/lib/sources/firms";
import { fetchNeaDay } from "../src/lib/sources/nea";
import { dayAQ, fetchHistoryAQ, fetchHistoryWind, gridQuery } from "../src/lib/sources/openmeteo";
import { sgDate, shiftDate } from "../src/lib/util";

const DIR = "data/history";
const CHUNK_DAYS = 10; // days built from one pair of Open-Meteo requests (wind then spans 13 days, within its 14-day unit)
const NEA_PAUSE_MS = 4000; // two NEA requests per day; data.gov.sg allows 6 anonymous calls per 10 s

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new Error(`--${name} needs a date as YYYY-MM-DD`);
  return v;
}

async function main() {
  const to = arg("to", sgDate(-1));
  const from = arg("from", to);
  if (from > to) throw new Error(`--from ${from} is after --to ${to}`);
  if (to >= sgDate(0)) throw new Error(`--to ${to}: that SGT day is not over yet`);
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) console.warn("WARNING: FIRMS_MAP_KEY is not set, so no day has fires and every day will fail its fire check.");

  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) dates.push(d);

  mkdirSync(DIR, { recursive: true });
  const indexFile = `${DIR}/index.json`;
  let index: HistoryIndex = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : { updated: "", days: [] };
  const { lats, lons } = gridQuery();
  const failed: string[] = [];

  for (let c = 0; c < dates.length; c += CHUNK_DAYS) {
    const chunk = dates.slice(c, c + CHUNK_DAYS);
    const first = chunk[0];
    const last = chunk.at(-1)!;
    let shared;
    try {
      // An SGT day is 16:00 UTC the day before to 16:00 UTC; its trail needs wind from three days before.
      const aq = await fetchHistoryAQ(shiftDate(first, -1), last);
      const frames = await fetchHistoryWind(shiftDate(first, -3), last);
      const fires = key ? await fetchFiresRange(key, shiftDate(first, -1), last) : [];
      shared = { aq, frames, fires };
    } catch (e) {
      console.error(`${first} to ${last}: ${e instanceof Error ? e.message : e}`);
      failed.push(...chunk);
      continue;
    }
    for (const date of chunk) {
      try {
        const nea = await fetchNeaDay(date);
        const day = assertFires(buildDay({ date, fires: shared.fires, frames: shared.frames, aq: dayAQ(shared.aq, lats, lons, date), nea }));
        const text = JSON.stringify(day);
        writeFileSync(`${DIR}/${date}.json`, text);
        index = addToIndex(index, day);
        writeFileSync(indexFile, JSON.stringify(index));
        const fires = day.totals.sumatra + day.totals.borneo + day.totals.peninsula;
        console.log(`${date}: ${(text.length / 1000).toFixed(1)} KB, ${fires} fires, PSI max ${day.nea.psiMax ?? "none"}`);
      } catch (e) {
        console.error(`${date}: ${e instanceof Error ? e.message : e}`);
        failed.push(date);
      }
      await sleep(NEA_PAUSE_MS);
    }
  }
  if (failed.length) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
