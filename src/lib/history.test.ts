import assert from "node:assert/strict";
import { test } from "node:test";
import { addToIndex, buildDay, latestFireDay, type HistoryDay, type HistoryIndex } from "@/lib/history";
import type { Fire } from "@/lib/types";
import { SG } from "@/lib/util";
import type { WindFrame } from "@/lib/wind";

const DATE = "2026-08-05";
const LATS = Array.from({ length: 14 }, (_, i) => i - 6); // the 1° grid: 14 x 26 = 364 points
const LONS = Array.from({ length: 26 }, (_, i) => i + 95);
const CELLS = LATS.length * LONS.length;

/** A repeatable stream of numbers in [0, 1), so the fixtures have realistic, unrounded digits. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Hourly wind frames from three days before `DATE` (UTC) to the end of `DATE`, west to east at 5 m/s with noise. */
function frames(): WindFrame[] {
  const r = rng(1);
  const t0 = Date.parse(`${DATE}T00:00:00Z`) - 3 * 86400_000;
  return Array.from({ length: 96 }, (_, h) => ({
    t: t0 + h * 3600_000,
    u: { lats: LATS, lons: LONS, data: Array.from({ length: CELLS }, () => 5 + r()) },
    v: { lats: LATS, lons: LONS, data: Array.from({ length: CELLS }, () => r() - 0.5) },
  }));
}

/** The 8 three-hourly frames of the SGT day, as UTC instants: 16:00 the day before to 13:00. */
const TIMES = Array.from({ length: 8 }, (_, k) => new Date(Date.parse(`${DATE}T00:00:00+08:00`) + k * 3 * 3600_000).toISOString());

/** Every CAMS variable on the full grid; the ranges are about what CAMS gives over the region in a hazy week. */
function aq(): Parameters<typeof buildDay>[0]["aq"] {
  const r = rng(2);
  const field = (lo: number, span: number) => TIMES.map(() => Array.from({ length: CELLS }, () => lo + r() * span));
  return {
    times: TIMES,
    lats: LATS,
    lons: LONS,
    values: { pm25: field(5, 140), pm10: field(10, 190), co: field(120, 500), no2: field(0, 30), so2: field(0, 40), o3: field(40, 80), dust: field(0, 50) },
  };
}

/** `n` fires inside `DATE` (SGT) over Sumatra, with unrounded coordinates and a different FRP each. */
function fires(n: number): Fire[] {
  const r = rng(3);
  return Array.from({ length: n }, (_, i) => ({
    lat: -2 + r() * 4,
    lon: 101 + r() * 4,
    frp: 1 + (i % 997) / 10 + r(),
    time: new Date(Date.parse(`${DATE}T00:00:00+08:00`) + r() * 86399_000).toISOString().slice(0, 19) + "Z",
    confidence: "n",
  }));
}

const nea = { psiMax: 88, pm25Max: 71 };
const build = (f: Fire[], grids = aq()) => buildDay({ date: DATE, fires: f, frames: frames(), aq: grids, nea });

test("buildDay keeps at most 1500 fires but totals count all", () => {
  // No gas grids here, so the size limit does not come into it.
  const day = build(fires(2000), { ...aq(), values: {} });
  assert.equal(day.fires.length, 1500);
  assert.equal(day.totals.sumatra + day.totals.borneo + day.totals.peninsula, 2000);
  // The strongest are kept, strongest first.
  const frps = day.fires.map((f) => f[2]);
  assert.deepEqual(frps, [...frps].sort((a, b) => b - a));
  const all = fires(2000).map((f) => Math.round(f.frp));
  assert.equal(frps[0], Math.max(...all));
});

test("buildDay rounds lat/lon to 2 decimals and FRP to an integer", () => {
  const day = build([{ lat: -1.23456, lon: 102.98765, frp: 12.6, time: `${DATE}T03:00:00Z`, confidence: "n" }]);
  assert.deepEqual(day.fires, [[-1.23, 102.99, 13]]);
});

test("buildDay counts only fires acquired inside the SGT day", () => {
  const f = (time: string): Fire => ({ lat: 0, lon: 102, frp: 5, time, confidence: "n" });
  // The SGT day is 2026-08-04T16:00Z (inclusive) to 2026-08-05T16:00Z (exclusive).
  const day = build([f("2026-08-04T15:59:59Z"), f("2026-08-04T16:00:00Z"), f("2026-08-05T15:59:59Z"), f("2026-08-05T16:00:00Z")]);
  assert.equal(day.fires.length, 2);
  assert.equal(day.totals.sumatra, 2);
});

test("buildDay has 8 frames of wind and gases on the 364-point grid, rounded", () => {
  const day = build(fires(10));
  assert.deepEqual(day.times, TIMES);
  assert.equal(day.wind.u.length, 8);
  assert.equal(day.wind.u[0].length, 364);
  assert.equal(day.wind.v[7].length, 364);
  assert.ok(day.wind.u.flat().every((x) => Math.round(x * 10) === x * 10 || Math.abs(Math.round(x * 10) / 10 - x) < 1e-9));
  assert.deepEqual(Object.keys(day.gases).sort(), ["co", "dust", "no2", "o3", "pm10", "pm25", "so2"]);
  assert.ok(Object.values(day.gases).every((g) => g!.length === 8 && g!.every((f) => f.length === 364 && f.every(Number.isInteger))));
  assert.deepEqual(day.nea, nea);
});

test("buildDay traces the 72 h trail back from Singapore, upwind of it", () => {
  const { trail } = build([]);
  assert.deepEqual(trail[0], [SG.lat, SG.lon]);
  // Wind blows towards the east, so the air came from the west, until the trail leaves the grid (at 95 E).
  assert.ok(trail.length > 40);
  assert.ok(trail.at(-1)![1] < 97);
});

test("buildDay refuses wind frames that do not reach the day", () => {
  assert.throws(() => buildDay({ date: DATE, fires: [], frames: frames().slice(0, 40), aq: aq(), nea }), /wind/i);
});

test("buildDay output for one day is under 100 KB of JSON", () => {
  const day = build(fires(1500));
  const bytes = Buffer.byteLength(JSON.stringify(day));
  assert.ok(bytes < 100_000, `${bytes} bytes`);
  // The fires that do not fit are the weakest; the totals still count all of them.
  assert.ok(day.fires.length > 300 && day.fires.length < 1500);
  assert.equal(day.totals.sumatra + day.totals.borneo + day.totals.peninsula, 1500);
  const frps = day.fires.map((f) => f[2]);
  assert.deepEqual(frps, [...frps].sort((a, b) => b - a));
});

const entry = (date: string, fires = 1, psiMax: number | null = 50) => ({ date, fires, psiMax });

test("addToIndex replaces the same date and keeps order", () => {
  const index: HistoryIndex = { updated: "2026-08-03T00:00:00Z", days: [entry("2026-08-01"), entry("2026-08-03", 3)] };
  const day = { date: "2026-08-02", totals: { sumatra: 4, borneo: 5, peninsula: 6 }, nea: { psiMax: 77, pm25Max: 1 } } as HistoryDay;
  const added = addToIndex(index, day, new Date("2026-08-04T00:00:00Z"));
  assert.deepEqual(added.days.map((d) => d.date), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  // Fires in the index are Sumatra and Borneo, as the live replay counts them.
  assert.deepEqual(added.days[1], { date: "2026-08-02", fires: 9, psiMax: 77 });
  assert.equal(added.updated, "2026-08-04T00:00:00.000Z");
  const again = addToIndex(added, { ...day, nea: { psiMax: null, pm25Max: null } } as HistoryDay);
  assert.equal(again.days.length, 3);
  assert.equal(again.days[1].psiMax, null);
  assert.equal(index.days.length, 2); // the input is not changed
});

test("latestFireDay skips a day with 3 fires", () => {
  const days = [{ date: "a", fires: new Array(120) }, { date: "b", fires: new Array(40) }, { date: "c", fires: new Array(3) }];
  assert.equal(latestFireDay(days)?.date, "b");
  assert.equal(latestFireDay(days, 1)?.date, "c");
  assert.equal(latestFireDay([{ fires: [] }]), undefined);
});
