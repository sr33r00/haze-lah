// Writes the readings archive: data/readings/<date>.json for each Singapore (SGT) day, and data/readings/index.json.
//
//   npx tsx scripts/readings.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]     (default: yesterday, SGT)
//   npx tsx scripts/readings.ts --capture                                 (hourly, from alerts.yml)
//
// Daily run, per day:
//   NEA        hourly PSI, sub-indices, PM2.5 and the pollutant concentrations for the 5 regions, from the dated feeds on
//              data.gov.sg (DATA_GOV_SG_API_KEY if set). If NEA fails the day is not saved and the exit code is non-zero.
//   OpenAQ     hourly PM2.5 of the community sensors the site shows, from /sensors/{id}/hours (OPENAQ_API_KEY). Without the key
//              it is skipped with a warning and the day says so. A failed sensor request is recorded, not turned into zeros.
//   APIMS      Malaysia's API serves only each station's latest hour, so there is no history to read. `--capture` keeps that
//              hour as it is published; the daily run adds what was captured for the day.
//
// Capture: appends the latest APIMS hour to a buffer (.readings-cache/, kept between runs by the workflow's cache) and copies
// it to data/readings/pending/<date>.json every few hours, so commits stay few. It prints `flush=true` to $GITHUB_OUTPUT when
// a copy was written. The daily run folds each pending file into its day's file and removes it.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import {
  addToPending,
  addToReadingsIndex,
  assembleDay,
  buildApims,
  buildNea,
  buildOpenAq,
  flushDue,
  foldApims,
  type OpenAqPart,
  type PendingDay,
  type ReadingsDay,
  type ReadingsIndex,
  type SourceId,
} from "../src/lib/readingsArchive";
import { fetchApimsRows } from "../src/lib/sources/apims";
import { NEA_PAUSE_MS, fetchNeaDayFeeds } from "../src/lib/sources/nea";
import { fetchPm25Locations, fetchSensorHours, openaqKey } from "../src/lib/sources/openaq";
import { sgDate, sgtTime, shiftDate, sleep } from "../src/lib/util";

const DIR = "data/readings";
const PENDING = `${DIR}/pending`;
const BUFFER = ".readings-cache";
const MAX_KB = 60; // a day's file should stay under this
const FLUSH_EVERY_MS = 6 * 3600_000; // hours of captured readings that wait in the cache before a copy is committed
const OPENAQ_CHUNK_DAYS = 30; // one request per sensor covers a chunk (24 hours x 30 days is under the 1000-row page)
const OPENAQ_PAUSE_MS = 1100; // OpenAQ allows 60 requests a minute

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) throw new Error(`--${name} needs a date as YYYY-MM-DD`);
  return v;
}

const readJson = <T>(file: string): T | undefined => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : undefined);
const writeJson = (file: string, v: unknown) => writeFileSync(file, JSON.stringify(v));
const dateOf = (file: string) => file.replace(/\.json$/, "");

/** The community sensors' hours for each date of a range, or a reason the source has nothing. Pauses between requests. */
async function fetchOpenAq(key: string, dates: string[]) {
  const parts: Record<string, OpenAqPart> = {};
  const notes: Record<string, string> = {};
  try {
    const locs = await fetchPm25Locations(key, sgtTime(dates[0]));
    if (!locs.length) console.warn("OpenAQ: no sensors reported since the first day");
    for (let c = 0; c < dates.length; c += OPENAQ_CHUNK_DAYS) {
      const chunk = dates.slice(c, c + OPENAQ_CHUNK_DAYS);
      // The first stamp of a day (00:00) ends the hour before it, so the window starts an hour early.
      const from = sgtTime(chunk[0]) - 3600_000;
      const to = sgtTime(shiftDate(chunk.at(-1)!, 1));
      const sensors: { loc: (typeof locs)[number]; hours: { t: string; v: number }[] }[] = [];
      let failed = 0;
      for (const loc of locs) {
        try {
          sensors.push({ loc, hours: await fetchSensorHours(key, loc.sensorId, from, to) });
        } catch (e) {
          failed++;
          console.warn(`OpenAQ sensor ${loc.id}: ${e instanceof Error ? e.message : e}`);
        }
        await sleep(OPENAQ_PAUSE_MS);
      }
      Object.assign(parts, buildOpenAq(sensors, chunk));
      for (const d of chunk) if (failed) notes[d] = failed === locs.length ? "failed: every sensor request failed" : `partial: ${failed} of ${locs.length} sensor requests failed`;
    }
  } catch (e) {
    for (const d of dates) notes[d] = `failed: ${e instanceof Error ? e.message : e}`;
  }
  return { parts, notes };
}

async function daily() {
  const to = arg("to", sgDate(-1));
  const from = arg("from", to);
  if (from > to) throw new Error(`--from ${from} is after --to ${to}`);
  if (to >= sgDate(0)) throw new Error(`--to ${to}: that SGT day is not over yet`);
  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) dates.push(d);

  const key = openaqKey();
  if (!key) console.warn("WARNING: OPENAQ_API_KEY is not set, so the community sensors are skipped (the days say so).");
  const openaq = key ? await fetchOpenAq(key, dates) : { parts: {}, notes: Object.fromEntries(dates.map((d) => [d, "skipped: no OpenAQ key"])) };

  mkdirSync(PENDING, { recursive: true });
  const indexFile = `${DIR}/index.json`;
  let index: ReadingsIndex = readJson(indexFile) ?? { updated: "", days: [] };
  const failed: string[] = [];

  for (const date of dates) {
    try {
      const feeds = await fetchNeaDayFeeds(date);
      const nea = buildNea(feeds, date);
      if (!nea) throw new Error("NEA has no readings for the day");
      const notes: Partial<Record<SourceId, string>> = {};
      if (!feeds.psi.length) notes.nea = "no PSI feed";
      else if (!feeds.pm25.length) notes.nea = "no PM2.5 feed";
      if (openaq.notes[date]) notes.openaq = openaq.notes[date];
      const pending = readJson<PendingDay>(`${PENDING}/${date}.json`);
      const day = assembleDay(date, { nea, apims: pending?.apims, openaq: openaq.parts[date] }, notes, readJson<ReadingsDay>(`${DIR}/${date}.json`));
      const text = JSON.stringify(day);
      writeFileSync(`${DIR}/${date}.json`, text);
      rmSync(`${PENDING}/${date}.json`, { force: true });
      index = addToReadingsIndex(index, day);
      writeJson(indexFile, index);
      const kb = text.length / 1000;
      if (kb > MAX_KB) console.warn(`${date}: ${kb.toFixed(1)} KB is over ${MAX_KB} KB`);
      console.log(`${date}: ${kb.toFixed(1)} KB, ${day.nea!.hours.length} NEA hours, sources ${Object.keys(day).filter((k) => ["nea", "apims", "openaq"].includes(k)).join("+")}${day.missing ? `, missing ${JSON.stringify(day.missing)}` : ""}`);
    } catch (e) {
      console.error(`${date}: ${e instanceof Error ? e.message : e}`);
      failed.push(date);
    }
    await sleep(NEA_PAUSE_MS);
  }

  // Captured hours that arrived after their day was built: add them to that day's file.
  for (const f of existsSync(PENDING) ? readdirSync(PENDING) : []) {
    const date = dateOf(f);
    const pending = readJson<PendingDay>(`${PENDING}/${f}`);
    const day = readJson<ReadingsDay>(`${DIR}/${date}.json`);
    if (!pending || !day || date >= sgDate(0)) continue;
    const next = foldApims(day, pending.apims);
    writeJson(`${DIR}/${date}.json`, next);
    rmSync(`${PENDING}/${f}`);
    index = addToReadingsIndex(index, next);
    writeJson(indexFile, index);
    console.log(`${date}: added captured APIMS hours`);
  }

  if (failed.length) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

async function capture() {
  const rows = await fetchApimsRows();
  const parts = buildApims(rows);
  if (!Object.keys(parts).length) throw new Error(`APIMS: no station with a reading in ${rows.length} rows`);
  mkdirSync(BUFFER, { recursive: true });
  const today = sgDate(0);

  // The buffer is the cache's copy; with no cache, start from what is committed.
  const load = (date: string) => readJson<PendingDay>(`${BUFFER}/${date}.json`) ?? readJson<PendingDay>(`${PENDING}/${date}.json`);
  for (const [date, part] of Object.entries(parts)) writeJson(`${BUFFER}/${date}.json`, addToPending(load(date), date, part));

  let due = false;
  for (const f of readdirSync(BUFFER)) {
    const date = dateOf(f);
    const p = readJson<PendingDay>(`${BUFFER}/${f}`)!;
    if (flushDue(p, today, FLUSH_EVERY_MS)) {
      const next = { ...p, flushed: p.latest };
      mkdirSync(PENDING, { recursive: true });
      writeJson(`${PENDING}/${f}`, next);
      writeJson(`${BUFFER}/${f}`, next);
      due = true;
      console.log(`${date}: ${Object.keys(next.apims.hours).length} stations, copy for commit`);
    } else if (date < today && p.latest <= p.flushed) {
      rmSync(`${BUFFER}/${f}`); // a finished day that is already committed
    }
  }
  console.log(`captured ${rows.length} stations (${Object.keys(parts).join(", ")}), flush=${due}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `flush=${due}\n`);
}

(process.argv.includes("--capture") ? capture() : daily()).catch((e) => {
  console.error(e);
  process.exit(1);
});
