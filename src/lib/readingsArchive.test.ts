import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APIMS_KEYS,
  NEA_SERIES,
  addToPending,
  addToReadingsIndex,
  assembleDay,
  buildApims,
  buildNea,
  buildOpenAq,
  flushDue,
  foldApims,
  mergeApims,
  type NeaKey,
  type ReadingsDay,
} from "@/lib/readingsArchive";
import type { ApimsRow } from "@/lib/sources/apims";
import type { NeaItem } from "@/lib/sources/nea";
import { parseHours } from "@/lib/sources/openaq";

const DATE = "2026-10-20";
const hh = (h: number) => `${String(h).padStart(2, "0")}:00:00+08:00`;
const region = (base: number) => ({ central: base + 4.26, east: base + 1, north: base - 2, south: base, west: base + 7 });

/** A day of NEA items as data.gov.sg serves them (newest first): `psi` carries the PSI feed's readings, `pm25` the PM2.5 feed's. */
function neaFeeds(hours = 24) {
  const stamps = Array.from({ length: hours }, (_, k) => hours - 1 - k);
  const psi: NeaItem[] = stamps.map((h) => ({
    timestamp: `${DATE}T${hh(h)}`,
    readings: Object.fromEntries(Object.values(NEA_SERIES).filter((v) => v !== "pm25_one_hourly").map((v, i) => [v, region(10 + h + i)])),
  }));
  const pm25: NeaItem[] = stamps.map((h) => ({ timestamp: `${DATE}T${hh(h)}`, readings: { pm25_one_hourly: region(30 + h) } }));
  return { psi, pm25 };
}

function row(id: string, time: string | null, over: Partial<ApimsRow["reading"]> = {}): ApimsRow {
  return {
    station: { id, name: `Station ${id}`, state: "Selangor", country: "MY", lat: 3.1234567, lon: 101.6543210, api: 60, pm25: 32, time, distanceKm: 300 },
    reading: { api: 60.2, pm25: 31.649, pm10: 35.161, o3: 35.034, co: 0.425, so2: 1.451, no2: null, ...over },
  };
}

test("NEA: one row per hour, one value per region, every series, rounded to a decimal", () => {
  const part = buildNea(neaFeeds(), DATE)!;
  assert.deepEqual(part.hours, Array.from({ length: 24 }, (_, h) => h));
  assert.deepEqual(part.regions, ["north", "south", "east", "west", "central"]);
  for (const k of Object.keys(NEA_SERIES) as NeaKey[]) {
    assert.equal(part[k].length, 24, k);
    assert.ok(part[k].every((r) => r.length === 5), k);
  }
  assert.deepEqual(part.pm25_1h[0], [28, 30, 31, 37, 34.3]); // north, south, east, west, central at hour 0
});

test("NEA: a missing feed gives nulls, not zeros; no hours at all gives null", () => {
  const f = neaFeeds(3);
  const noPsi = buildNea({ psi: [], pm25: f.pm25 }, DATE)!;
  assert.ok(noPsi.psi.every((r) => r.every((v) => v === null)));
  assert.ok(noPsi.pm25_1h.every((r) => r.every((v) => v !== null)));
  assert.equal(buildNea({ psi: [], pm25: [] }, DATE), null);
  assert.equal(buildNea(f, "2026-10-19"), null); // items of another day are not this day's
});

test("APIMS: a row lands on the SGT date and hour of its stamp, with rounded values in key order", () => {
  const out = buildApims([row("A1", "2026-10-20T16:00:00.000Z"), row("A2", "2026-10-21T04:00:00.000Z")]); // 00:00 and 12:00 SGT on the 21st
  assert.deepEqual(Object.keys(out), ["2026-10-21"]);
  const part = out["2026-10-21"];
  assert.deepEqual(part.keys, APIMS_KEYS);
  const v = [60, 31.6, 35.2, 35, 0.4, 1.5, null];
  assert.equal(part.hours.A1.length, 24);
  assert.deepEqual(part.hours.A1.map((x, h) => (x ? h : -1)).filter((h) => h >= 0), [0]);
  assert.deepEqual(part.hours.A1[0], v);
  assert.deepEqual(part.hours.A2[12], v);
  assert.deepEqual(part.stations.A1, { name: "Station A1", state: "Selangor", lat: 3.123, lon: 101.654 });
});

test("APIMS: rows with no stamp or no value are left out", () => {
  const none = { api: null, pm25: null, pm10: null, o3: null, co: null, so2: null, no2: null };
  assert.deepEqual(buildApims([row("A", null), row("B", "2026-10-20T04:00:00.000Z", none)]), {});
});

test("APIMS: parts merge by station and hour, the new one wins", () => {
  const a = buildApims([row("A", "2026-10-20T04:00:00.000Z"), row("B", "2026-10-20T04:00:00.000Z")])[DATE];
  const b = buildApims([row("A", "2026-10-20T04:00:00.000Z", { pm25: 40 }), row("A", "2026-10-20T05:00:00.000Z")])[DATE];
  const m = mergeApims(a, b);
  assert.equal(m.hours.A[12]![1], 40);
  assert.ok(m.hours.A[13]);
  assert.ok(m.hours.B[12]);
});

const loc = (id: number) => ({ id, name: `AG ${id}`, lat: 1.3, lon: 103.8, sensorId: id * 10 });

test("OpenAQ: hours are stamped by the end of the hour, split by SGT date, and only the dates asked for are kept", () => {
  // 16:00Z the day before is 00:00 SGT; the hour ending 00:00 SGT on the 20th belongs to hour 0 of the 20th.
  const hours = [
    { t: "2026-10-19T16:00:00.000Z", v: 12.34 },
    { t: "2026-10-20T04:00:00.000Z", v: 20 },
    { t: "2026-10-20T16:00:00.000Z", v: 8 }, // 00:00 SGT on the 21st
  ];
  const out = buildOpenAq([{ loc: loc(7), hours }], [DATE]);
  assert.deepEqual(Object.keys(out), [DATE]);
  assert.deepEqual(out[DATE].hours[7].map((v, h) => (v == null ? null : [h, v])).filter(Boolean), [[0, 12.3], [12, 20]]);
  assert.deepEqual(out[DATE].sensors[7], { name: "AG 7", lat: 1.3, lon: 103.8 });
});

test("OpenAQ: the hours answer is read for its end instant, and faulty values are dropped", () => {
  const p = (from: string, to: string, value: unknown) => ({ value, period: { datetimeFrom: { utc: from }, datetimeTo: { utc: to } } });
  const hours = parseHours({
    results: [
      p("2026-10-20T03:00:00Z", "2026-10-20T04:00:00Z", 15.5),
      p("2026-10-20T04:00:00Z", "2026-10-20T05:00:00Z", -999),
      p("2026-10-20T05:00:00Z", "2026-10-20T06:00:00Z", 5000),
      p("2026-10-20T06:00:00Z", "2026-10-20T07:00:00Z", null),
      { value: 9, period: { datetimeFrom: { utc: "2026-10-20T07:00:00Z" } } }, // no end given: start plus an hour
    ],
  });
  assert.deepEqual(hours, [
    { t: "2026-10-20T04:00:00.000Z", v: 15.5 },
    { t: "2026-10-20T08:00:00.000Z", v: 9 },
  ]);
  assert.deepEqual(parseHours({}), []);
});

test("a day: a source with nothing is listed as missing with a reason, never as zeros", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  const day = assembleDay(DATE, { nea }, { openaq: "skipped: no OpenAQ key" });
  assert.equal(day.apims, undefined);
  assert.equal(day.openaq, undefined);
  assert.equal(day.missing?.openaq, "skipped: no OpenAQ key");
  assert.match(day.missing?.apims ?? "", /not captured/);
  assert.equal(day.missing?.nea, undefined);
});

test("a day: a run without OpenAQ keeps the OpenAQ part the file already had, and adds captured APIMS hours", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  const openaq = buildOpenAq([{ loc: loc(1), hours: [{ t: "2026-10-20T04:00:00.000Z", v: 20 }] }], [DATE])[DATE];
  const first = assembleDay(DATE, { nea, openaq }, {});
  assert.equal(first.missing?.openaq, undefined);
  const apims = buildApims([row("A", "2026-10-20T04:00:00.000Z")])[DATE];
  const second = assembleDay(DATE, { nea, apims }, { openaq: "skipped: no OpenAQ key" }, first);
  assert.deepEqual(second.openaq, openaq);
  assert.ok(second.apims?.hours.A);
  assert.equal(second.missing, undefined); // OpenAQ is kept, so the skip note does not apply; APIMS is there
});

test("a day: a partial OpenAQ run keeps its data and says what failed", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  const openaq = buildOpenAq([{ loc: loc(1), hours: [{ t: "2026-10-20T04:00:00.000Z", v: 20 }] }], [DATE])[DATE];
  const day = assembleDay(DATE, { nea, openaq }, { openaq: "partial: 2 of 9 sensor requests failed" });
  assert.ok(day.openaq);
  assert.equal(day.missing?.openaq, "partial: 2 of 9 sensor requests failed");
});

test("foldApims adds hours to a built day and clears its APIMS note, keeping the other notes", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  const day = assembleDay(DATE, { nea }, { openaq: "skipped: no OpenAQ key" });
  const folded = foldApims(day, buildApims([row("A", "2026-10-20T04:00:00.000Z")])[DATE]);
  assert.deepEqual(Object.keys(folded.missing ?? {}), ["openaq"]);
  assert.ok(folded.apims?.hours.A);
});

test("the index lists each day's sources and what is missing, sorted, replacing a day built again", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  const a = assembleDay("2026-10-21", { nea }, {});
  const b = assembleDay(DATE, { nea }, {});
  let idx = addToReadingsIndex({ updated: "", days: [] }, a);
  idx = addToReadingsIndex(idx, b);
  assert.deepEqual(idx.days.map((d) => d.date), [DATE, "2026-10-21"]);
  assert.deepEqual(idx.days[0], { date: DATE, sources: ["nea"], missing: ["apims", "openaq"] });
  const withApims = assembleDay(DATE, { nea, apims: buildApims([row("A", "2026-10-20T04:00:00.000Z")])[DATE] }, {});
  idx = addToReadingsIndex(idx, withApims);
  assert.equal(idx.days.length, 2);
  assert.deepEqual(idx.days[0].sources, ["nea", "apims"]);
});

test("capture: flush waits for 6 hours of new readings, and a finished day is flushed at once", () => {
  const H = 3600_000;
  const at = (h: number) => `2026-10-20T${String(h - 8).padStart(2, "0")}:00:00.000Z`;
  let p = addToPending(undefined, DATE, buildApims([row("A", at(9))])[DATE]);
  p = { ...p, flushed: p.latest }; // committed
  assert.equal(flushDue(p, DATE, 6 * H), false);
  p = addToPending(p, DATE, buildApims([row("A", at(14))])[DATE]);
  assert.equal(flushDue(p, DATE, 6 * H), false); // 5 hours
  assert.equal(p.flushed, Date.parse(`${DATE}T09:00:00+08:00`)); // addToPending keeps what was committed
  p = addToPending(p, DATE, buildApims([row("A", at(15))])[DATE]);
  assert.equal(flushDue(p, DATE, 6 * H), true);
  assert.equal(flushDue(p, "2026-10-21", 6 * H), true);
  const done = { ...p, flushed: p.latest };
  assert.equal(flushDue(done, "2026-10-21", 6 * H), false);
  assert.deepEqual(p.apims.hours.A.flatMap((v, h) => (v ? [h] : [])), [9, 14, 15]);
});

test("size: a full day (NEA, 47 APIMS stations, 30 community sensors) stays under 60 KB", () => {
  const nea = buildNea(neaFeeds(), DATE)!;
  // Values like the live ones: unrounded floats, a gap here and there.
  const rows: ApimsRow[] = [];
  const parts = Array.from({ length: 24 }, (_, h) => {
    const t = new Date(Date.parse(`${DATE}T${hh(h)}`)).toISOString();
    for (let s = 0; s < 47; s++)
      rows.push(row(`S${s}`, t, { api: 40 + ((s * 7 + h) % 60), pm25: 12.345 + ((s * 3 + h) % 50), pm10: 25.5 + s, o3: 10.123 + h, co: 0.2 + (s % 5) / 10, so2: s % 4 ? 1.25 : null, no2: s % 3 ? 4.5 + h : null }));
    return buildApims(rows.splice(0))[DATE];
  });
  const apims = parts.reduce((a, b) => mergeApims(a, b));
  const hours = Array.from({ length: 24 }, (_, h) => ({ t: new Date(Date.parse(`${DATE}T${hh(h)}`)).toISOString(), v: 10.123456 + h }));
  const openaq = buildOpenAq(Array.from({ length: 30 }, (_, i) => ({ loc: loc(i + 1), hours })), [DATE])[DATE];
  const day: ReadingsDay = assembleDay(DATE, { nea, apims, openaq }, {});
  const kb = JSON.stringify(day).length / 1000;
  assert.ok(kb < 60, `${kb.toFixed(1)} KB`);
});
