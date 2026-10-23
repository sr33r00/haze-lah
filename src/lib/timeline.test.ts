import assert from "node:assert/strict";
import { test } from "node:test";
import type { HistoryIndex } from "@/lib/historyTypes";
import { buildBars, eventMarks, moveDay, moveStep, nearestStep, playNext, psiByDate, selectAt, stepsOf, type Bar } from "@/lib/timeline";
import type { DayPsi, Replay, ReplayDay, SmokeGrid } from "@/lib/types";

const TODAY = "2026-10-23";

const idx = (days: [string, number, number | null][]): HistoryIndex => ({
  updated: "2026-10-23T00:00:00Z",
  days: days.map(([date, fires, psiMax]) => ({ date, fires, psiMax })),
});
const replayOf = (days: [string, number][]): Replay => ({
  lats: [],
  lons: [],
  days: days.map(([date, total]) => ({ date, total, arrival: `${date}T06:00:00.000Z` }) as ReplayDay),
});
/** Smoke steps every 3 h from `start` (ISO UTC) for `n` steps. */
const smokeFrom = (start: string, n: number): SmokeGrid => ({
  lats: [],
  lons: [],
  times: Array.from({ length: n }, (_, k) => new Date(Date.parse(start) + k * 3 * 3600_000).toISOString()),
  values: [],
  gases: {},
  wind: null,
});
// 06:00 SGT on the 23rd, 72 h: covers the 23rd, 24th, 25th and 26th (SGT).
const SMOKE = smokeFrom("2026-10-22T22:00:00.000Z", 25);
const dates = (bars: Bar[]) => bars.map((b) => b.date);

test("bars run from the first history date to the last forecast date with no duplicates", () => {
  const bars = buildBars(
    idx([["2026-10-20", 100, null], ["2026-10-21", 200, null], ["2026-10-22", 300, null]]),
    replayOf([["2026-10-22", 310], [TODAY, 400]]),
    SMOKE,
    TODAY,
  );
  assert.deepEqual(dates(bars), ["2026-10-20", "2026-10-21", "2026-10-22", TODAY, "2026-10-24", "2026-10-25", "2026-10-26"]);
  assert.equal(new Set(dates(bars)).size, bars.length);
  assert.deepEqual(bars.map((b) => b.kind), ["past", "past", "past", "today", "forecast", "forecast", "forecast"]);
});

test("history overrides the live replay for a date the index lists; the live replay fills the others", () => {
  // The live replay's oldest day is partial (FIRMS's window), so its 20 must not replace the index's complete 300.
  const bars = buildBars(idx([["2026-10-21", 200, null], ["2026-10-22", 300, null]]), replayOf([["2026-10-22", 20], [TODAY, 400]]), SMOKE, TODAY);
  assert.deepEqual(bars[0], { date: "2026-10-21", kind: "past", fires: 200, source: "history" });
  assert.deepEqual(bars[1], { date: "2026-10-22", kind: "past", fires: 300, source: "history" });
  assert.deepEqual(bars[2], { date: TODAY, kind: "today", fires: 400, source: "live" });
});

test("a date only the live replay has (the newest days before the daily job) is live", () => {
  const bars = buildBars(idx([["2026-10-20", 100, null]]), replayOf([["2026-10-22", 310], [TODAY, 400]]), SMOKE, TODAY);
  assert.deepEqual(bars.slice(0, 4).map((b) => [b.date, b.fires, b.source]), [
    ["2026-10-20", 100, "history"],
    ["2026-10-21", null, "none"],
    ["2026-10-22", 310, "live"],
    [TODAY, 400, "live"],
  ]);
});

test("a missing middle day is source none", () => {
  const bars = buildBars(idx([["2026-10-19", 10, null], ["2026-10-22", 40, null]]), replayOf([]), SMOKE, TODAY);
  assert.deepEqual(bars.slice(0, 4), [
    { date: "2026-10-19", kind: "past", fires: 10, source: "history" },
    { date: "2026-10-20", kind: "past", fires: null, source: "none" },
    { date: "2026-10-21", kind: "past", fires: null, source: "none" },
    { date: "2026-10-22", kind: "past", fires: 40, source: "history" },
  ]);
  // today has neither: a gap up to today, still the today bar
  assert.deepEqual(bars[4], { date: TODAY, kind: "today", fires: null, source: "none" });
});

test("forecast bars have fires null and source live", () => {
  const bars = buildBars(idx([["2026-10-22", 1, null]]), replayOf([[TODAY, 2]]), SMOKE, TODAY);
  const fc = bars.filter((b) => b.kind === "forecast");
  assert.equal(fc.length, 3);
  for (const b of fc) assert.deepEqual([b.fires, b.source], [null, "live"]);
});

test("with no index, bars start at the first replay day", () => {
  const bars = buildBars(null, replayOf([["2026-10-20", 5], ["2026-10-21", 6], ["2026-10-22", 7], [TODAY, 8]]), SMOKE, TODAY);
  assert.equal(bars[0].date, "2026-10-20");
  assert.ok(bars.slice(0, 4).every((b) => b.source === "live"));
});

test("with nothing known there is no gap before today", () => {
  const bars = buildBars(null, replayOf([]), SMOKE, TODAY);
  assert.deepEqual(dates(bars), [TODAY, "2026-10-24", "2026-10-25", "2026-10-26"]);
});

test("history dates after today are ignored", () => {
  const bars = buildBars(idx([["2026-10-22", 1, null], ["2026-10-30", 9, null]]), replayOf([]), SMOKE, TODAY);
  assert.ok(!dates(bars).includes("2026-10-30"));
});

test("eventMarks finds the first PSI above 100 and 200", () => {
  const index = idx([["2026-10-18", 1, 80], ["2026-10-19", 1, 100], ["2026-10-20", 1, 120], ["2026-10-21", 1, 210], ["2026-10-22", 1, 250]]);
  assert.deepEqual(eventMarks(index, []), [
    { date: "2026-10-20", label: "PSI 100+" },
    { date: "2026-10-21", label: "PSI 200+" },
  ]);
});

test("eventMarks lets live psiDaily override the index and covers later dates", () => {
  const index = idx([["2026-10-20", 1, 150], ["2026-10-21", 1, null]]);
  const psi: DayPsi[] = [
    { date: "2026-10-20", max: 90, region: "west" }, // live says 90: overrides 150
    { date: "2026-10-22", max: 205, region: "west" },
  ];
  assert.deepEqual(eventMarks(index, psi), [{ date: "2026-10-22", label: "PSI 100+" }, { date: "2026-10-22", label: "PSI 200+" }]);
  assert.deepEqual(eventMarks(null, []), []);
  assert.deepEqual(eventMarks(idx([["2026-10-20", 1, 99]]), [{ date: "2026-10-21", max: 100, region: "west" }]), []);
});

test("stepsOf: today and forecast bars use the smoke steps in that SGT date", () => {
  const today = stepsOf({ date: TODAY, kind: "today", fires: 1, source: "live" }, SMOKE);
  // 22:00Z on the 22nd is 06:00 SGT on the 23rd; steps at 06, 09, 12, 15, 18, 21 SGT
  assert.equal(today.length, 6);
  assert.equal(today[0], "2026-10-22T22:00:00.000Z");
  const fc = stepsOf({ date: "2026-10-25", kind: "forecast", fires: null, source: "live" }, SMOKE);
  assert.equal(fc.length, 8);
  assert.equal(fc[0], "2026-10-24T16:00:00.000Z");
});

test("stepsOf: a past history day has 8 SGT steps, a live one its 14:00 SGT arrival, a gap none", () => {
  const h = stepsOf({ date: "2026-10-21", kind: "past", fires: 1, source: "history" }, SMOKE);
  assert.equal(h.length, 8);
  assert.equal(h[0], "2026-10-20T16:00:00.000Z"); // 00:00 SGT
  assert.equal(h[7], "2026-10-21T13:00:00.000Z"); // 21:00 SGT
  assert.deepEqual(stepsOf({ date: "2026-10-22", kind: "past", fires: 1, source: "live" }, SMOKE), ["2026-10-22T06:00:00.000Z"]);
  assert.deepEqual(stepsOf({ date: "2026-10-20", kind: "past", fires: null, source: "none" }, SMOKE), []);
});

test("stepsOf: today without a smoke forecast still has its 14:00 SGT air path; a forecast day has none", () => {
  const none = smokeFrom("2026-10-22T22:00:00.000Z", 0);
  assert.deepEqual(stepsOf({ date: TODAY, kind: "today", fires: 1, source: "live" }, none), ["2026-10-23T06:00:00.000Z"]);
  assert.deepEqual(stepsOf({ date: "2026-10-24", kind: "forecast", fires: null, source: "live" }, none), []);
});

test("psiByDate lets live psiDaily override the index", () => {
  const m = psiByDate(idx([["2026-10-20", 1, 150], ["2026-10-21", 1, null]]), [{ date: "2026-10-20", max: 90, region: "west" }]);
  assert.deepEqual([...m], [["2026-10-20", 90]]);
});

// Navigation over: the 19th, 21st and 22nd (history, 8 steps; the 20th is a gap), today (6 steps) and three forecast days.
const NAV = buildBars(idx([["2026-10-19", 1, null], ["2026-10-21", 1, null], ["2026-10-22", 1, null]]), replayOf([]), SMOKE, TODAY);
const stepsFor = (b: Bar) => stepsOf(b, SMOKE);

test("nearestStep picks the step closest in time; 0 for none", () => {
  const steps = stepsFor(NAV.find((b) => b.date === "2026-10-21")!);
  assert.equal(nearestStep(steps, Date.parse("2026-10-21T15:00:00+08:00")), 5);
  assert.equal(nearestStep([], Date.now()), 0);
});

test("moveDay keeps the time of day, skips gaps and stops at the ends", () => {
  const at15 = selectAt(NAV.find((b) => b.date === "2026-10-22")!, stepsFor(NAV.find((b) => b.date === "2026-10-22")!), 15);
  assert.deepEqual(at15, { date: "2026-10-22", step: 5 });
  assert.deepEqual(moveDay(NAV, stepsFor, at15, -1), { date: "2026-10-21", step: 5 });
  assert.deepEqual(moveDay(NAV, stepsFor, { date: "2026-10-21", step: 5 }, -1), { date: "2026-10-19", step: 5 }); // the 20th is a gap
  assert.equal(moveDay(NAV, stepsFor, { date: "2026-10-19", step: 5 }, -1), null);
  assert.equal(moveDay(NAV, stepsFor, { date: "2026-10-26", step: 0 }, 1), null);
});

test("moveStep goes step by step and over the day boundary", () => {
  assert.deepEqual(moveStep(NAV, stepsFor, { date: "2026-10-21", step: 3 }, 1), { date: "2026-10-21", step: 4 });
  assert.deepEqual(moveStep(NAV, stepsFor, { date: "2026-10-21", step: 7 }, 1), { date: "2026-10-22", step: 0 });
  assert.deepEqual(moveStep(NAV, stepsFor, { date: "2026-10-22", step: 0 }, -1), { date: "2026-10-21", step: 7 });
});

test("playNext: past days one at a time at the same hour, then every step of today and the forecast, then the end", () => {
  assert.deepEqual(playNext(NAV, stepsFor, { date: "2026-10-21", step: 5 }), { date: "2026-10-22", step: 5 });
  assert.deepEqual(playNext(NAV, stepsFor, { date: "2026-10-22", step: 5 }), { date: TODAY, step: 0 });
  assert.deepEqual(playNext(NAV, stepsFor, { date: TODAY, step: 0 }), { date: TODAY, step: 1 });
  assert.deepEqual(playNext(NAV, stepsFor, { date: TODAY, step: 5 }), { date: "2026-10-24", step: 0 });
  assert.equal(playNext(NAV, stepsFor, { date: "2026-10-26", step: stepsFor(NAV.at(-1)!).length - 1 }), null);
});
