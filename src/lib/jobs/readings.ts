import { listKeys, readJsonStrict, removeKey, writeJson } from "../dataStore";
import {
  addToPending,
  addToReadingsIndex,
  assembleDay,
  buildApims,
  buildNea,
  buildOpenAq,
  foldApims,
  type OpenAqPart,
  type PendingDay,
  type ReadingsDay,
  type ReadingsIndex,
  type SourceId,
} from "../readingsArchive";
import { fetchApimsRows } from "../sources/apims";
import { NEA_PAUSE_MS, fetchNeaDayFeeds } from "../sources/nea";
import { fetchPm25Locations, fetchSensorHours, openaqKey } from "../sources/openaq";
import { sgDate, sgtTime, shiftDate, sleep } from "../util";
import { dayRange } from "./range";

// Readings archive: `readings/<date>.json` for each Singapore (SGT) day, `readings/index.json`, and `readings/pending/<date>.json`
// for the APIMS hours captured since the day was last built.

const MAX_KB = 60; // a day's file should stay under this
const OPENAQ_CHUNK_DAYS = 30; // one request per sensor covers a chunk (24 hours x 30 days is under the 1000-row page)
const OPENAQ_PAUSE_MS = 1100; // OpenAQ allows 60 requests a minute

const PENDING = "readings/pending/";
const dayKey = (date: string) => `readings/${date}.json`;
const pendingKey = (date: string) => `${PENDING}${date}.json`;
const INDEX = "readings/index.json";

/** What the capture step did: the SGT dates that got an hour, and how many stations answered. */
export type CaptureResult = { stations: number; dates: string[] };

/** What the daily step did: the days built, the days that got captured APIMS hours added, and the failures (`date: reason`) and notes. */
export type ReadingsResult = { built: string[]; folded: string[]; failed: string[]; notes: string[] };

/**
 * Keeps the latest APIMS hour. Malaysia's API serves only each station's latest hour, so there is no history to read: each hour is
 * added to `readings/pending/<date>.json`, and the daily run adds what was captured to the day's file. An hour captured again is
 * replaced by itself, so a repeated run changes nothing. Throws when no station has a reading.
 */
export async function captureApims(): Promise<CaptureResult> {
  const rows = await fetchApimsRows();
  const parts = buildApims(rows);
  const dates = Object.keys(parts);
  if (!dates.length) throw new Error(`APIMS: no station with a reading in ${rows.length} rows`);
  for (const date of dates) {
    const pending = await readJsonStrict<PendingDay>(pendingKey(date));
    await writeJson(pendingKey(date), addToPending(pending ?? undefined, date, parts[date]));
  }
  return { stations: rows.length, dates };
}

/** The community sensors' hours for each date of a range, or a reason the source has nothing. Pauses between requests. */
async function fetchOpenAq(key: string, dates: string[], notes: string[]) {
  const parts: Record<string, OpenAqPart> = {};
  const why: Record<string, string> = {};
  try {
    const locs = await fetchPm25Locations(key, sgtTime(dates[0]));
    if (!locs.length) notes.push("OpenAQ: no sensors reported since the first day");
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
          notes.push(`OpenAQ sensor ${loc.id}: ${e instanceof Error ? e.message : e}`);
        }
        await sleep(OPENAQ_PAUSE_MS);
      }
      Object.assign(parts, buildOpenAq(sensors, chunk));
      for (const d of chunk) if (failed) why[d] = failed === locs.length ? "failed: every sensor request failed" : `partial: ${failed} of ${locs.length} sensor requests failed`;
    }
  } catch (e) {
    for (const d of dates) why[d] = `failed: ${e instanceof Error ? e.message : e}`;
  }
  return { parts, why };
}

/**
 * Builds the readings archive for each SGT day from `from` to `to` (default: yesterday).
 *
 *   NEA     hourly PSI, sub-indices, PM2.5 and the pollutant concentrations for the 5 regions, from the dated feeds on data.gov.sg
 *           (DATA_GOV_SG_API_KEY if set). If NEA fails the day is not saved and is listed in `failed`.
 *   OpenAQ  hourly PM2.5 of the community sensors the site shows, from /sensors/{id}/hours (OPENAQ_API_KEY). Without the key it is
 *           skipped with a note and the day says so. A failed sensor request is recorded, not turned into zeros.
 *   APIMS   what `captureApims` kept for the day is added to it, and its pending file removed.
 *
 * Pending files of earlier days that arrived after their day was built are then added to that day's file.
 */
export async function buildReadings(from: string | null, to: string | null): Promise<ReadingsResult> {
  const dates = dayRange(from, to);
  const result: ReadingsResult = { built: [], folded: [], failed: [], notes: [] };

  const key = openaqKey();
  if (!key) result.notes.push("OPENAQ_API_KEY is not set, so the community sensors are skipped (the days say so)");
  const openaq = key ? await fetchOpenAq(key, dates, result.notes) : { parts: {}, why: Object.fromEntries(dates.map((d) => [d, "skipped: no OpenAQ key"])) };

  let index = (await readJsonStrict<ReadingsIndex>(INDEX)) ?? { updated: "", days: [] };

  for (const date of dates) {
    try {
      const feeds = await fetchNeaDayFeeds(date);
      const nea = buildNea(feeds, date);
      if (!nea) throw new Error("NEA has no readings for the day");
      const notes: Partial<Record<SourceId, string>> = {};
      if (!feeds.psi.length) notes.nea = "no PSI feed";
      else if (!feeds.pm25.length) notes.nea = "no PM2.5 feed";
      if (openaq.why[date]) notes.openaq = openaq.why[date];
      const pending = await readJsonStrict<PendingDay>(pendingKey(date));
      const day = assembleDay(date, { nea, apims: pending?.apims, openaq: openaq.parts[date] }, notes, (await readJsonStrict<ReadingsDay>(dayKey(date))) ?? undefined);
      const text = JSON.stringify(day);
      await writeJson(dayKey(date), day);
      await removeKey(pendingKey(date));
      index = addToReadingsIndex(index, day);
      await writeJson(INDEX, index);
      if (text.length / 1000 > MAX_KB) result.notes.push(`${date}: ${(text.length / 1000).toFixed(1)} KB is over ${MAX_KB} KB`);
      result.built.push(date);
    } catch (e) {
      result.failed.push(`${date}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(NEA_PAUSE_MS);
  }

  // Captured hours that arrived after their day was built: add them to that day's file.
  for (const k of await listKeys(PENDING)) {
    const date = k.slice(PENDING.length).replace(/\.json$/, "");
    const pending = await readJsonStrict<PendingDay>(k);
    const day = await readJsonStrict<ReadingsDay>(dayKey(date));
    if (!pending || !day || date >= sgDate(0)) continue;
    const next = foldApims(day, pending.apims);
    await writeJson(dayKey(date), next);
    await removeKey(k);
    index = addToReadingsIndex(index, next);
    await writeJson(INDEX, index);
    result.folded.push(date);
  }
  return result;
}
