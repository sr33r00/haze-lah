import assert from "node:assert/strict";
import { test } from "node:test";
import type { HistoryDay } from "@/lib/history";
import type { Replay, ReplayDay, SmokeGrid } from "@/lib/types";
import { SG } from "@/lib/util";
import { frameGeo, globeDay } from "./frame";

const TODAY = "2026-10-23";
const LATS = [0, 1, 2, 3];
const LONS = [100, 101, 102, 103, 104, 105];
const CELLS = LATS.length * LONS.length;
const flat = (v: number) => Array.from({ length: CELLS }, () => v);

/** `n` fires spread out from (lat0, lon0), 1 degree apart (more than the 50 km new-zone rule). */
const firesAt = (n: number, lat0: number, lon0: number): [number, number][] => Array.from({ length: n }, (_, k) => [lat0 + k * 0.1, lon0 + k]);
const trailOf = (tag: number): [number, number][] => [[SG.lat, SG.lon], [SG.lat, SG.lon - tag]];

const replayDay = (date: string, fires: [number, number][], extra: Partial<ReplayDay> = {}): ReplayDay =>
  ({ date, arrival: `${date}T06:00:00.000Z`, trail: trailOf(1), fires, total: fires.length, wind: { u: flat(2), v: flat(-1) }, ahead: null, ...extra }) as ReplayDay;

const replayOf = (days: ReplayDay[]): Replay => ({ lats: LATS, lons: LONS, days });

// 06:00 SGT on the 23rd, every 3 h for 25 steps (72 h): covers the 23rd to the 26th (SGT).
const times = Array.from({ length: 25 }, (_, k) => new Date(Date.parse("2026-10-22T22:00:00.000Z") + k * 3 * 3600_000).toISOString());
const smokeOf = (wind: { u: number; v: number } | null = { u: 3, v: 0 }): SmokeGrid => ({
  lats: LATS,
  lons: LONS,
  times,
  values: times.map((_, k) => flat(10 + k)),
  gases: { co: times.map((_, k) => flat(1000 + k)) },
  wind: wind && { u: times.map(() => flat(wind.u)), v: times.map(() => flat(wind.v)) },
});

const historyDay = (date: string, fires: [number, number][]): HistoryDay => ({
  date,
  fires: fires.map(([lat, lon]) => [lat, lon, 40]),
  totals: { sumatra: fires.length, borneo: 0, peninsula: 0 },
  times: Array.from({ length: 8 }, (_, k) => `${date}T${String(k * 3).padStart(2, "0")}:00:00.000Z`),
  lats: LATS,
  lons: LONS,
  wind: { u: Array.from({ length: 8 }, (_, k) => flat(k)), v: Array.from({ length: 8 }, () => flat(-1)) },
  gases: { pm25: Array.from({ length: 8 }, (_, k) => flat(50 + k)), co: Array.from({ length: 8 }, (_, k) => flat(900 + k)) },
  trail: trailOf(7),
  nea: { psiMax: 80, pm25Max: 30 },
});

test("past day from history uses its fires and trail", () => {
  const day = globeDay({ history: historyDay("2026-09-10", firesAt(5, 0, 100)) }, "2026-09-10", 2, "pm25", TODAY);
  assert.equal(day.kind, "past");
  assert.equal(day.date, "2026-09-10");
  assert.equal(day.fires.length, 5);
  assert.deepEqual(day.fires[0], [0, 100, 40]);
  assert.deepEqual(day.trail, trailOf(7));
  assert.deepEqual(day.ahead, []);
  // The frame asked for: step 2 of PM2.5 and of the wind.
  assert.equal(day.field?.[0], 52);
  assert.equal(day.wind?.u[0], 2);
  assert.equal(day.wind?.v[0], -1);
  assert.deepEqual(day.grid, { lats: LATS, lons: LONS });
});

test("past day from history reads the layer's gas and dims the days before it", () => {
  const before = [historyDay("2026-09-06", firesAt(2, 10, 100)), historyDay("2026-09-07", firesAt(3, 10, 105))];
  const day = globeDay({ history: historyDay("2026-09-10", firesAt(5, 0, 100)), before }, "2026-09-10", 0, "co", TODAY);
  assert.equal(day.field?.[0], 900);
  assert.equal(day.older.length, 5);
  assert.deepEqual(day.older[0], [10, 100]);
  // Nothing within 50 km of the fires of the days before: all 5 are new, one per 30 km.
  assert.equal(day.fresh.length, 5);
});

test("only the previous four days are dimmed", () => {
  const before = Array.from({ length: 6 }, (_, k) => historyDay(`2026-09-0${k + 1}`, [[10 + k, 110]]));
  const day = globeDay({ history: historyDay("2026-09-10", firesAt(1, 0, 100)), before }, "2026-09-10", 0, "off", TODAY);
  assert.deepEqual(day.older, [[12, 110], [13, 110], [14, 110], [15, 110]]);
});

test("a new fire is one with none within 50 km on the days before", () => {
  const near: [number, number] = [0.2, 100.2]; // about 30 km from the old fire
  const before = [historyDay("2026-09-09", [[0, 100]])];
  const day = globeDay({ history: historyDay("2026-09-10", [near, [2, 103]]), before }, "2026-09-10", 0, "off", TODAY);
  assert.deepEqual(day.fresh, [[2, 103]]);
});

test("layer off gives field null", () => {
  const history = historyDay("2026-09-10", firesAt(5, 0, 100));
  assert.equal(globeDay({ history }, "2026-09-10", 0, "off", TODAY).field, null);
  // The satellite picture is not the CAMS field either.
  assert.equal(globeDay({ history }, "2026-09-10", 0, "smoke", TODAY).field, null);
  assert.equal(globeDay({ replay: replayOf([replayDay(TODAY, firesAt(30, 0, 100))]), smoke: smokeOf() }, TODAY, 0, "off", TODAY).field, null);
});

test("today reads the smoke grid at the step, and has the path ahead", () => {
  const ahead = { path: [[1, 102], [1.2, 101]] } as ReplayDay["ahead"];
  const replay = replayOf([replayDay("2026-10-22", firesAt(30, 0, 100)), replayDay(TODAY, firesAt(40, 0, 100), { ahead })]);
  const pm = globeDay({ replay, smoke: smokeOf() }, TODAY, 3, "pm25", TODAY);
  assert.equal(pm.kind, "today");
  assert.equal(pm.field?.[0], 13); // smoke.values[3]; the 23rd starts at index 0
  assert.equal(pm.wind?.u[0], 3);
  assert.deepEqual(pm.ahead, [[1, 102], [1.2, 101]]);
  assert.deepEqual(pm.trail, trailOf(1));
  assert.equal(pm.fires.length, 40);
  assert.equal(globeDay({ replay, smoke: smokeOf() }, TODAY, 3, "co", TODAY).field?.[0], 1003);
  assert.equal(globeDay({ replay, smoke: smokeOf({ u: 1, v: 1 }) }, TODAY, 0, "pm25", TODAY).wind?.v[0], 1);
  assert.equal(globeDay({ replay, smoke: smokeOf(null) }, TODAY, 0, "pm25", TODAY).wind, null);
});

test("uses latestFireDay when today's live day has under 20 fires", () => {
  const replay = replayOf([
    replayDay("2026-10-20", firesAt(30, 0, 100)),
    replayDay("2026-10-21", firesAt(30, 0, 100)),
    replayDay("2026-10-22", firesAt(25, 2, 102)),
    replayDay(TODAY, firesAt(4, 0, 100), { trail: trailOf(3) }),
  ]);
  const day = globeDay({ replay, smoke: smokeOf() }, TODAY, 0, "pm25", TODAY);
  assert.equal(day.fires.length, 25); // the 22nd's, not today's 4
  assert.deepEqual(day.fires[0], [2, 102, 0]);
  assert.deepEqual(day.older.length, 60); // the days before the 22nd
  assert.deepEqual(day.trail, trailOf(3)); // the path is still today's
  assert.ok(day.fresh.length > 0 && day.fresh.length <= 25);
});

test("a live past day has no grid, and its wind and trail", () => {
  const replay = replayOf([replayDay("2026-10-21", firesAt(30, 0, 100), { trail: trailOf(5) }), replayDay("2026-10-22", firesAt(30, 0, 100)), replayDay(TODAY, firesAt(30, 0, 100))]);
  const day = globeDay({ replay, smoke: smokeOf() }, "2026-10-21", 0, "pm25", TODAY);
  assert.equal(day.kind, "past");
  assert.equal(day.field, null);
  assert.equal(day.wind?.u[0], 2);
  assert.deepEqual(day.trail, trailOf(5));
  assert.deepEqual(day.ahead, []);
});

test("forecast day has no fresh rings and dims today's fires", () => {
  const replay = replayOf([replayDay("2026-10-22", firesAt(30, 5, 100)), replayDay(TODAY, firesAt(40, 0, 100))]);
  const day = globeDay({ replay, smoke: smokeOf() }, "2026-10-25", 1, "pm25", TODAY);
  assert.equal(day.kind, "forecast");
  assert.deepEqual(day.fires, []);
  assert.deepEqual(day.fresh, []);
  assert.equal(day.older.length, 40);
  assert.deepEqual(day.older[0], [0, 100]);
  assert.deepEqual(day.ahead, []);
  assert.equal(day.field?.[0], 10 + 14 + 1); // the 25th starts at index 14 (06:00 SGT on the 23rd + 42 h = 00:00 on the 25th)
});

test("forecast trail comes from the forecast wind and covers only the hours that exist", () => {
  const replay = replayOf([replayDay(TODAY, firesAt(40, 0, 100))]);
  const day = globeDay({ replay, smoke: smokeOf({ u: 0.5, v: 0 }) }, "2026-10-25", 0, "pm25", TODAY);
  // 14:00 SGT on the 25th is 56 h after the first frame: 56 hours back, 57 points; the air came from the west.
  assert.equal(day.trail.length, 57);
  assert.deepEqual(day.trail[0], [SG.lat, SG.lon]);
  assert.ok(day.trail.at(-1)![1] < SG.lon - 0.5);
  // The 23rd's 14:00 is only 8 h after the first frame; a forecast date before the frames, or no wind, gives no trail and never throws.
  assert.deepEqual(globeDay({ replay, smoke: smokeOf(null) }, "2026-10-25", 0, "pm25", TODAY).trail, []);
  assert.deepEqual(globeDay({ replay, smoke: smokeOf({ u: 0.5, v: 0 }) }, "2026-10-22", 0, "pm25", "2026-10-21").trail, []);
});

test("a day with nothing to show is empty, not an error", () => {
  const day = globeDay({}, "2026-09-10", 0, "pm25", TODAY);
  assert.deepEqual([day.fires, day.older, day.fresh, day.trail, day.ahead, day.field, day.wind], [[], [], [], [], [], null, null]);
});

test("frameGeo draws each list, with hour dots on the trail", () => {
  const trail: [number, number][] = Array.from({ length: 73 }, (_, h) => [SG.lat, SG.lon - h * 0.1]);
  const day = globeDay({ history: { ...historyDay("2026-09-10", firesAt(3, 0, 100)), trail } }, "2026-09-10", 0, "off", TODAY);
  const geo = frameGeo(day);
  assert.equal(geo.fires.features.length, 3);
  assert.equal(geo.trail.features.length, 1);
  assert.deepEqual(geo.hours.features.map((f) => f.properties?.label), ["24 h", "48 h", "72 h"]);
  assert.deepEqual((geo.fires.features[0].geometry as GeoJSON.Point).coordinates, [100, 0]); // lon, lat
  assert.equal(frameGeo(globeDay({}, "2026-09-10", 0, "off", TODAY)).trail.features.length, 0);
});
