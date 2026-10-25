import assert from "node:assert/strict";
import { test } from "node:test";
import type { Accuracy, LeadScore } from "@/lib/accuracy";
import { answerText, bestWindow, dayWind, instrumentHours, latestObserved, peakAhead, readoutLines, readoutText, shortLeadNote, skillRows, skillSentence, type InstrumentHour } from "@/lib/forecastHours";
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
  assert.deepEqual(answerText(peak, window, NOW), { headline: "Haziest tomorrow around 2pm: PM2.5 118.", tip: "Best time to go out: today 7–10am." });
});

test("answerText writes the weekday further out, am and pm on both ends across noon, and the no-window line", () => {
  const peak = { t: "2026-10-27T06:00:00Z", pm25: 90 }; // Tue 2pm SGT
  assert.equal(answerText(peak, null, NOW).headline, "Haziest Tuesday around 2pm: PM2.5 90.");
  assert.equal(answerText(peak, null, NOW).tip, "No clear window to go out in the next 48 hours.");
  assert.equal(answerText(peak, { from: "2026-10-25T03:00:00Z", to: "2026-10-25T06:00:00Z" }, NOW).tip, "Best time to go out: tomorrow 11am–2pm.");
});

test("answerText says haziest today when the peak is today, and rounds the number", () => {
  const peak = { t: "2026-10-24T08:00:00Z", pm25: 90.6 }; // today 4pm SGT
  assert.equal(answerText(peak, null, NOW).headline, "Haziest today around 4pm: PM2.5 91.");
});

test("answerText says haziest right now when the latest reading is at or above the peak and over 55", () => {
  const peak = { t: "2026-10-25T06:00:00Z", pm25: 118 };
  const window = { from: "2026-10-23T23:00:00Z", to: "2026-10-24T02:00:00Z" };
  assert.deepEqual(answerText(peak, window, NOW, 140.4), { headline: "Haziest right now: PM2.5 140.", tip: "Best time to go out: today 7–10am." });
  assert.equal(answerText(peak, window, NOW, 118).headline, "Haziest right now: PM2.5 118.");
  assert.equal(answerText(peak, window, NOW, 117).headline, "Haziest tomorrow around 2pm: PM2.5 118.");
  assert.equal(answerText(peak, window, NOW, null).headline, "Haziest tomorrow around 2pm: PM2.5 118.");
});

test("answerText calls a forecast that stays at or under 55 clear, with the peak as the upper figure", () => {
  const peak = { t: "2026-10-25T06:00:00Z", pm25: 48 };
  const window = { from: "2026-10-23T23:00:00Z", to: "2026-10-24T02:00:00Z" };
  assert.deepEqual(answerText(peak, window, NOW, 30), {
    headline: "Clear air for the next 48 hours: PM2.5 up to 48.",
    tip: "Best time to go out: today 7–10am.",
  });
  assert.equal(answerText({ ...peak, pm25: 55 }, null, NOW, 55).headline, "Clear air for the next 48 hours: PM2.5 up to 55.");
  assert.equal(answerText({ ...peak, pm25: 55 }, null, NOW, 55).tip, "No clear window to go out in the next 48 hours.");
  // The "right now" line wins over a clear forecast only when the latest reading is over 55.
  assert.equal(answerText(peak, window, NOW, 70).headline, "Haziest right now: PM2.5 70.");
  assert.equal(answerText(peak, window, NOW, 55).headline, "Clear air for the next 48 hours: PM2.5 up to 48.");
});

test("answerText ends the tip with the short-lead note, and handles no forecast", () => {
  const peak = { t: "2026-10-25T06:00:00Z", pm25: 118 };
  const note = "Next 6 hours: check Now.";
  const window = { from: "2026-10-23T23:00:00Z", to: "2026-10-24T02:00:00Z" };
  assert.equal(answerText(peak, null, NOW, null, note).tip, `No clear window to go out in the next 48 hours. ${note}`);
  assert.equal(answerText(peak, window, NOW, null, note).tip, `Best time to go out: today 7–10am. ${note}`);
  assert.equal(answerText({ ...peak, pm25: 40 }, null, NOW, 20, note).tip, `No clear window to go out in the next 48 hours. ${note}`);
  assert.deepEqual(answerText(null, null, NOW, 200), { headline: "No forecast for the next 48 hours.", tip: "No clear window to go out in the next 48 hours." });
});

test("latestObserved is the newest measured value, or null", () => {
  assert.equal(latestObserved(instrumentHours(observed(5), forecast(5), [], null)), 34);
  assert.equal(latestObserved(rows(0, [40, 50])), null);
});

const TOMORROW_2PM = "2026-10-25T06:00:00Z";
const hour = (over: Partial<InstrumentHour> = {}): InstrumentHour => ({ t: TOMORROW_2PM, observed: null, pm25: 118.4, low: 84.2, high: 160.1, raw: 64.3, pHigh: 0.71, rainProb: 30, wind: { t: TOMORROW_2PM, from: "SW", deg: 225, kmh: 22, near: 1240, area: "Riau" }, ...over });

test("readoutLines gives exact short copy for a forecast hour", () => {
  assert.deepEqual(readoutLines(hour(), NOW), {
    when: "Tomorrow 2pm",
    figures: ["PM2.5 118 (84–160)", "71% above 55"],
    line1: "Tomorrow 2pm  PM2.5 118 (84–160)  71% above 55",
    line2: "Copernicus 64, wind SW 22 km/h",
    fires: "over 1,240 fires in Riau",
    rain: "Rain 30%",
  });
});

test("readoutLines drops the parts it has no data for, and says one fire in the singular", () => {
  const bare = readoutLines(hour({ low: null, high: null, raw: null, pHigh: null, rainProb: null, wind: null }), NOW);
  assert.deepEqual(bare, { when: "Tomorrow 2pm", figures: ["PM2.5 118"], line1: "Tomorrow 2pm  PM2.5 118", line2: "", fires: "", rain: "" });
  const one = readoutLines(hour({ wind: { t: TOMORROW_2PM, from: "N", deg: 0, kmh: 8, near: 1, area: "" } }), NOW);
  assert.equal(one.fires, "over 1 fire");
  assert.equal(one.line2, "Copernicus 64, wind N 8 km/h");
  assert.equal(readoutLines(hour({ wind: { t: TOMORROW_2PM, from: "N", deg: 0, kmh: 8, near: 0, area: "" } }), NOW).fires, "");
});

test("readoutLines shows a measured-only hour with its value, and a past hour as today", () => {
  const past = hour({ t: "2026-10-24T00:00:00Z", pm25: null, low: null, high: null, raw: null, pHigh: null, wind: null, observed: 31.6 });
  assert.deepEqual(readoutLines(past, NOW), { when: "Today 8am", figures: ["Measured 32 µg/m³"], line1: "Today 8am  Measured 32 µg/m³", line2: "", fires: "", rain: "Rain 30%" });
});

test("readoutText reads the wind out in full and joins the lines as sentences", () => {
  assert.equal(
    readoutText(hour(), NOW),
    "Tomorrow 2pm, PM2.5 118 (84–160), 71% above 55. Copernicus 64, from the southwest at 22 km/h, over 1,240 fires in Riau. Rain 30%",
  );
});

/** One lead of accuracy.json with the given mean absolute errors (ours, Copernicus, persistence) and forecast count. */
const lead = (h: number, ours: number | null, cams: number | null, persistence: number | null, n = 40): LeadScore => {
  const stats = (mae: number | null) => ({ n, mae, rmse: mae, bias: 0 });
  return { lead: h, ours: stats(ours), cams: stats(cams), persistence: stats(persistence), event: { n, precision: null, recall: null, f1: null } };
};
const accuracy = (leads: LeadScore[]): Accuracy => ({ updated: "2026-10-24T00:29:12.373Z", forecasts: 45, from: null, to: null, leads, hazyDays: { days: 0, hazy: 0, ours: { hits: 0, clearRight: 0 }, persistence: { hits: 0, clearRight: 0 } } });

test("skillRows drops leads with too few forecasts and is empty without a file", () => {
  const a = accuracy([lead(6, 20.1, 36.5, 14.8, 42), lead(24, 24.3, 37.4, 26.1, 19), lead(48, null, 40, 30, 40), lead(72, 30, 41, 31, 20)]);
  assert.deepEqual(skillRows(a), [
    { lead: 6, ours: 20.1, cams: 36.5, persistence: 14.8 },
    { lead: 72, ours: 30, cams: 41, persistence: 31 },
  ]);
  assert.deepEqual(skillRows(a, 10).map((r) => r.lead), [6, 24, 72]);
  assert.deepEqual(skillRows(null), []);
});

test("skillSentence and shortLeadNote give exact copy for the current accuracy.json leads", () => {
  const rows = skillRows(accuracy([lead(6, 20.1, 36.5, 14.8, 42), lead(24, 24.3, 37.4, 26.1, 39)]));
  assert.equal(skillSentence(rows), "From 24 hours ahead, this forecast beats both Copernicus and assuming no change.");
  assert.equal(shortLeadNote(rows), "Next 6 hours: check Now.");
});

test("shortLeadNote points to Now when any losing lead loses to persistence, else says the raw Copernicus model is closer", () => {
  const mixed = skillRows(accuracy([lead(6, 20, 36, 15), lead(24, 30, 25, 40), lead(48, 20, 30, 25), lead(72, 20, 30, 25)]));
  assert.equal(shortLeadNote(mixed), "Next 24 hours: check Now.");
  assert.equal(skillSentence(mixed), "From 48 hours ahead, this forecast beats both Copernicus and assuming no change.");
  const camsOnly = skillRows(accuracy([lead(6, 30, 25, 40), lead(24, 30, 25, 40), lead(48, 20, 30, 25)]));
  assert.equal(shortLeadNote(camsOnly), "Next 24 hours: the raw Copernicus model is closer.");
  assert.equal(skillSentence(camsOnly), "From 48 hours ahead, this forecast beats both Copernicus and assuming no change.");
});

test("the lead note and the claim start after the last losing lead, and the claim drops when the last lead loses", () => {
  const regain = skillRows(accuracy([lead(6, 20, 36, 15), lead(24, 10, 37, 26), lead(48, 20, 30, 15), lead(72, 10, 30, 25)]));
  assert.equal(shortLeadNote(regain), "Next 48 hours: check Now.");
  assert.equal(skillSentence(regain), "From 72 hours ahead, this forecast beats both Copernicus and assuming no change.");
  const lateLoss = skillRows(accuracy([lead(6, 10, 36, 15), lead(24, 30, 37, 26)]));
  assert.equal(shortLeadNote(lateLoss), "Next 24 hours: check Now.");
  assert.equal(skillSentence(lateLoss), null);
  const lateCams = skillRows(accuracy([lead(6, 10, 36, 15), lead(24, 30, 25, 40)]));
  assert.equal(shortLeadNote(lateCams), "Next 24 hours: the raw Copernicus model is closer.");
  assert.equal(skillSentence(lateCams), null);
});

test("skillSentence handles winning at every lead, winning at none, and no rows; shortLeadNote stays silent for them", () => {
  const win = skillRows(accuracy([lead(6, 10, 36, 15), lead(24, 24, 37, 26)]));
  assert.equal(skillSentence(win), "This forecast beats Copernicus and assuming no change at every lead time.");
  assert.equal(shortLeadNote(win), null);
  const lose = skillRows(accuracy([lead(6, 20, 36, 15), lead(24, 30, 37, 26)]));
  assert.equal(skillSentence(lose), "Assuming no change is the better guide at every lead time tested so far.");
  assert.equal(shortLeadNote(lose), null);
  assert.equal(skillSentence([]), null);
  assert.equal(shortLeadNote([]), null);
});

test("dayWind averages directions on the circle (350° and 10° give 0°) and is null for a day with no steps", () => {
  // 08:00 and 11:00 SGT on Sat 24 Oct are 00:00Z and 03:00Z; 08:00 SGT on the 25th is 00:00Z on the 25th.
  const at = (t: string, deg: number): OutlookStep => ({ ...step(0), t, deg });
  const steps = [at("2026-10-24T00:00:00Z", 350), at("2026-10-24T03:00:00Z", 10), at("2026-10-25T00:00:00Z", 90)];
  assert.equal(dayWind(steps, "2026-10-24"), 0);
  assert.equal(dayWind(steps, "2026-10-25"), 90);
  assert.equal(dayWind(steps, "2026-10-26"), null);
  assert.equal(dayWind([], "2026-10-24"), null);
  assert.equal(dayWind(null, "2026-10-24"), null);
});
