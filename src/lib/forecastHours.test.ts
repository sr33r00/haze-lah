import assert from "node:assert/strict";
import { test } from "node:test";
import { answerText, bestWindow, instrumentHours, peakAhead, type InstrumentHour } from "@/lib/forecastHours";
import type { ForecastPoint, HourPoint, OutlookStep, WeatherHour } from "@/lib/types";

const NOW = new Date("2026-10-24T01:30:00Z"); // 9:30am SGT, Sat 24 Oct
const T0 = Date.parse("2026-10-24T01:00:00Z"); // the last measured hour
const iso = (h: number) => new Date(T0 + h * 3600_000).toISOString();

const observed = (n: number): HourPoint[] => Array.from({ length: n }, (_, i) => ({ time: iso(i - n + 1), value: 30 + i }));
const forecast = (n: number, pm25 = (h: number) => 40 + h): ForecastPoint[] =>
  Array.from({ length: n }, (_, i) => ({ time: iso(i + 1), pm25: pm25(i + 1), low: 20, high: 90, raw: 25, pHigh: 0.3 }));
const weather = (from: number, to: number): WeatherHour[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ time: iso(from + i), windDir: 200, windSpeed: 10, rainProb: 20, rain: 0, gust: 15 }));
const step = (h: number): OutlookStep => ({ t: iso(h), from: "SW", deg: 225, kmh: 12, near: 3, area: "Riau" });
const outlook = Array.from({ length: 16 }, (_, i) => step(1 + i * 3));

/** Forecast-only rows, one per hour from `from` hours after T0, with the given values. */
const rows = (from: number, values: number[]): InstrumentHour[] =>
  values.map((pm25, i) => ({ t: iso(from + i), observed: null, pm25, low: null, high: null, raw: null, pHigh: null, rainProb: null, wind: null }));
// 07:00 SGT on Sat 24 Oct is 23:00Z on the 23rd, which is 2 h before T0 (01:00Z).
const SEVEN_AM = -2;

test("instrumentHours joins forecast, rain and 3-hourly wind on one hourly axis", () => {
  const hours = instrumentHours(observed(24), forecast(60), weather(-12, 48), outlook);
  assert.equal(hours.length, 60);
  assert.deepEqual(hours.map((h) => h.t), Array.from({ length: 60 }, (_, i) => iso(i - 11)));
  assert.deepEqual(hours.slice(0, 12).map((h) => h.pm25), Array(12).fill(null));
  assert.equal(hours[11].observed, 53);
  assert.equal(hours[12].pm25, 41);
  assert.equal(hours[12].observed, null);
  assert.equal(hours[12].rainProb, 20);
  const ahead = hours.slice(12);
  assert.equal(ahead.filter((h) => h.wind).length, 16);
  assert.ok(ahead.every((h, i) => (h.wind != null) === (i % 3 === 0)));
  assert.equal(ahead[3].wind?.area, "Riau");
});

test("instrumentHours keeps working without the wind outlook", () => {
  const hours = instrumentHours(observed(24), forecast(60), weather(-12, 48), null);
  assert.equal(hours.length, 60);
  assert.ok(hours.every((h) => h.wind === null));
});

test("instrumentHours spans only the forecast hours that exist", () => {
  const hours = instrumentHours(observed(12), forecast(20), [], outlook);
  assert.equal(hours.length, 12 + 20);
  for (const h of hours) for (const v of [h.observed, h.pm25, h.low, h.high, h.raw, h.pHigh, h.rainProb]) assert.ok(v === null || Number.isFinite(v));
});

test("peakAhead picks the highest forecast hour, ignoring the measured past", () => {
  const hours = instrumentHours([{ time: iso(0), value: 400 }], forecast(10, (h) => (h === 6 ? 120 : 50)), [], null);
  assert.deepEqual(peakAhead(hours), { t: iso(6), pm25: 120 });
  assert.equal(peakAhead(instrumentHours(observed(5), [], [], null)), null);
});

test("bestWindow finds the cleanest daylight run of at least 3 hours, earliest on a tie", () => {
  // 7am..6pm: a run of 40s (max 45) at 7-10am and again at 1-4pm, with 50s between; the earlier one wins and is widened to the 40s.
  const day = rows(SEVEN_AM, [40, 45, 40, 50, 50, 50, 40, 45, 40, 50, 50, 50]);
  const w = bestWindow(day);
  assert.deepEqual(w, { from: iso(SEVEN_AM), to: iso(SEVEN_AM + 3), max: 45 });
  assert.equal(bestWindow(rows(SEVEN_AM, [50, 30, 30, 30, 30, 60, 60, 60, 60, 60, 60, 60]))?.max, 30);
  assert.deepEqual(bestWindow(rows(SEVEN_AM, [50, 30, 30, 30, 30, 60, 60, 60, 60, 60, 60, 60])), { from: iso(SEVEN_AM + 1), to: iso(SEVEN_AM + 5), max: 30 });
});

test("bestWindow does not cross into night or bridge a gap", () => {
  // 5pm and 6pm are daylight; 7pm onward is night, so only two clean hours fit before it.
  assert.equal(bestWindow(rows(SEVEN_AM + 10, [20, 20, 20, 20, 20])), null);
  // 8am-10am clean but a missing 9am hour splits them into runs of 1 and 1.
  const gap = rows(SEVEN_AM + 1, [20, 20]);
  assert.equal(bestWindow([gap[0], { ...gap[1], t: iso(SEVEN_AM + 3) }]), null);
});

test("bestWindow is null when no daylight run stays at or under 55", () => {
  assert.equal(bestWindow(rows(SEVEN_AM, Array(12).fill(70))), null);
  assert.equal(bestWindow(rows(SEVEN_AM, [30, 30, 56, 30, 30, 56, 30, 30, 56, 30, 30, 56])), null);
  assert.equal(bestWindow(rows(SEVEN_AM, [])), null);
});

test("answerText gives exact copy for a peak tomorrow and a window today", () => {
  const peak = { t: "2026-10-25T06:00:00Z", pm25: 118 }; // tomorrow 2pm SGT
  const window = { from: "2026-10-23T23:00:00Z", to: "2026-10-24T02:00:00Z" }; // today 7-10am SGT
  assert.deepEqual(answerText(peak, window, NOW), { headline: "Worst tomorrow around 2pm, near 118 µg/m³.", detail: "Best window: today 7–10am." });
});

test("answerText writes the weekday further out, am and pm on both ends across noon, and the no-window line", () => {
  const peak = { t: "2026-10-27T06:00:00Z", pm25: 90 }; // Tue 2pm SGT
  assert.equal(answerText(peak, null, NOW).headline, "Worst Tuesday around 2pm, near 90 µg/m³.");
  assert.equal(answerText(peak, null, NOW).detail, "No clear window in the next 48 hours.");
  assert.equal(answerText(peak, { from: "2026-10-25T03:00:00Z", to: "2026-10-25T06:00:00Z" }, NOW).detail, "Best window: tomorrow 11am–2pm.");
});
