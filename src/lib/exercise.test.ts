import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_HOURS, RAIN_TEXT, bestSlots, bestTimeLine, fmtSlot, planSlot, planStrip, rate, ratingLegend, slotReason, weatherRatings } from "@/lib/exercise";
import type { ForecastPoint, WeatherHour } from "@/lib/types";

const START = Date.parse("2026-10-23T22:00:00Z"); // 6am SGT, Sat 24 Oct
const NOW = START;

/** `n` (48) hourly points from 6am SGT; `pm25` and `high` by hour index. */
const hourly = (pm25: (i: number) => number, high: (i: number) => number = (i) => pm25(i) + 10, n = 48): ForecastPoint[] =>
  Array.from({ length: n }, (_, i) => ({ time: new Date(START + i * 3600_000).toISOString(), pm25: pm25(i), low: 0, high: high(i), raw: pm25(i), pHigh: 0 }));

test("picks the steadier slot over a lower-mean slot with a spike in its range", () => {
  // Hours 1-2 (7-9am) have the lowest mean but hour 2 may spike; hours 4-5 are steady and a little higher.
  const h = hourly((i) => (i === 1 || i === 2 ? 20 : i === 4 || i === 5 ? 25 : 60), (i) => (i === 2 ? 120 : i === 4 || i === 5 ? 35 : 90));
  const [today] = bestSlots(h, "cycle", "healthy", NOW);
  assert.equal(today.startIndex, 4);
});

test("a part final hour counts by its fraction in the dust", () => {
  const h = hourly((i) => (i === 1 ? 10 : 100));
  const [today] = bestSlots(h, "run", "healthy", NOW, 1.5);
  assert.equal(today.startIndex, 1);
  assert.ok(Math.abs(today.dustUg - (10 * 1 + 100 * 0.5) * 2.94) < 1e-9);
  assert.equal(today.end, new Date(START + 2.5 * 3600_000).toISOString());
});

test("a 1 h run at PM2.5 80 breathes about 235 µg, 0.7 cigarettes", () => {
  const [today] = bestSlots(hourly(() => 80), "run", "healthy", NOW);
  assert.ok(Math.abs(today.dustUg - 235.2) < 1e-9);
  assert.equal(today.cigarettes, 0.7);
  assert.ok(Math.abs(today.timesNormal - 80 / 12) < 1e-9);
});

test("the rating follows the worst hour, not the mean", () => {
  // Mean 40 is band I, but the 2nd hour reaches 60 (band II: keep it easy).
  const h = hourly((i) => (i % 2 ? 60 : 20), () => 70);
  const [today] = bestSlots(h, "cycle", "healthy", NOW, 2);
  assert.equal(today.worst, 60);
  assert.equal(today.rating.tone, "easy"); // the mean would say "go"
});

test("only usual start hours are offered, and the session must fit the forecast", () => {
  const h = hourly((i) => (i < 6 ? 5 : 50)); // 6-11am is clean, but Kids play starts at 7 or later
  const [today, tomorrow] = bestSlots(h, "play", "healthy", NOW);
  assert.equal(today.startIndex, 1);
  assert.equal(tomorrow.day, "tomorrow");
  assert.equal(bestSlots(h.slice(0, 3), "out", "healthy", NOW).length, 0); // 3 h from 7am needs hour 1-3
  assert.equal(bestSlots(hourly(() => 5), "run", "healthy", NOW + 20 * 3600_000).filter((s) => s.day === "today").length, 1);
});

test("the strip starts at the current hour and drops hours that have ended", () => {
  const now = START + 3 * 3600_000 + 20 * 60_000; // 9:20am
  const h = hourly(() => 20);
  const strip = planStrip(h, "run", "healthy", now);
  assert.equal(strip[0].time, h[3].time);
});

test("the strip covers the next 16 hours, or what is left of the forecast", () => {
  const h = hourly(() => 20);
  assert.equal(planStrip(h, "run", "healthy", NOW).length, PLAN_HOURS);
  assert.equal(planStrip(h.slice(0, 10), "run", "healthy", NOW).length, 10);
});

test("each strip hour carries the chosen activity's rating", () => {
  const h = hourly((i) => 20 + i * 5);
  const run = planStrip(h, "run", "healthy", NOW);
  run.forEach((s, i) => assert.deepEqual(s.rating, rate(h[i].pm25, "run", "healthy")));
  const out = planStrip(h, "out", "healthy", NOW);
  assert.notDeepEqual(run[15].rating, out[15].rating); // PM2.5 95: "Keep it short and easy" for a run, not the going-out words
});

test("the legend lists the distinct answers of the activity, mildest first", () => {
  assert.deepEqual(ratingLegend("run", "healthy"), [
    { text: "Good to go", tones: ["go"] },
    { text: "Keep it short and easy", tones: ["easy"] },
    { text: "Better indoors", tones: ["stay"] },
    { text: "Rain likely", tones: [], cause: "rain" },
    { text: "Very high UV", tones: [], cause: "uv" },
  ]);
  // Kids play says the same words in band II and from band III, so both colours share one entry.
  assert.deepEqual(ratingLegend("play", "healthy"), [
    { text: "Good for outdoor play", tones: ["go"] },
    { text: "Play indoors instead", tones: ["limit", "stay"] },
    { text: "Rain likely", tones: [], cause: "rain" },
    { text: "Very high UV", tones: [], cause: "uv" },
  ]);
  assert.deepEqual(
    ratingLegend("out", "healthy").map((r) => r.text),
    ["Go ahead", "Cut back outdoors", "Keep outings short", "Stay in if you can", "Rain likely", "Very high UV, find shade"],
  );
  assert.deepEqual(
    ratingLegend("out", "sensitive").map((r) => r.text),
    ["Go ahead", "Keep outings short", "Stay indoors", "Rain likely", "Very high UV, find shade"],
  );
});

/** Weather for `n` hours from 6am SGT, by hour index. */
const wx = (rain: (i: number) => number | null, uv: (i: number) => number | null = () => 0, feels: (i: number) => number | null = () => 28, n = 48): WeatherHour[] =>
  Array.from({ length: n }, (_, i) => ({ time: new Date(START + i * 3600_000).toISOString(), windDir: 200, windSpeed: 10, rainProb: rain(i), rain: 0, gust: 10, uv: uv(i), feelsLike: feels(i) }));

test("without weather the answers are the air-only ones", () => {
  const h = hourly((i) => (i === 1 || i === 2 ? 20 : i === 4 || i === 5 ? 25 : 60), (i) => (i === 2 ? 120 : i === 4 || i === 5 ? 35 : 90));
  const plain = bestSlots(h, "cycle", "healthy", NOW);
  assert.deepEqual(bestSlots(h, "cycle", "healthy", NOW, undefined, []), plain);
  assert.deepEqual(bestSlots(h, "cycle", "healthy", NOW, undefined, wx(() => 0)).map((s) => [s.startIndex, s.rating]), plain.map((s) => [s.startIndex, s.rating]));
  assert.equal(plain[0].rainProb, null);
  assert.equal(plain[0].feelsLike, null);
});

test("a rainy hour is avoided when a dry session is as clean", () => {
  const h = hourly(() => 20);
  const rainy = wx((i) => (i < 4 ? 80 : 10)); // 6-10am wet
  const [today] = bestSlots(h, "run", "healthy", NOW, 1, rainy);
  assert.equal(today.startIndex, 4);
  assert.deepEqual(today.rating, { tone: "go", text: "Good to go" });
  assert.equal(today.rainProb, 10);
  // Every hour wet: the answer is the rain, for any activity.
  const wet = bestSlots(h, "out", "healthy", NOW, 1, wx(() => 60))[0];
  assert.deepEqual(wet.rating, { tone: "limit", text: RAIN_TEXT, cause: "rain" });
});

test("very high UV is avoided; going out only nudges toward shade", () => {
  const h = hourly(() => 20);
  const sun = wx(() => 0, (i) => (i <= 2 ? 9 : 2)); // 6 to 9am
  assert.equal(bestSlots(h, "run", "healthy", NOW, 1, sun)[0].startIndex, 3); // 9am, the first hour under 8
  const all = wx(() => 0, () => 9);
  assert.deepEqual(bestSlots(h, "run", "healthy", NOW, 1, all)[0].rating, { tone: "limit", text: "Very high UV", cause: "uv" });
  assert.deepEqual(bestSlots(h, "play", "healthy", NOW, 1, all)[0].rating, { tone: "limit", text: "Very high UV", cause: "uv" });
  assert.deepEqual(bestSlots(h, "out", "healthy", NOW, 1, all)[0].rating, { tone: "easy", text: "Very high UV, find shade", cause: "uv" });
  assert.deepEqual(weatherRatings({ rainProb: 49, uv: 7.9 }, "run"), []);
  assert.deepEqual(weatherRatings({ rainProb: 50, uv: 8 }, "run").map((r) => r.text), [RAIN_TEXT, "Very high UV"]);
});

test("haze still dominates, and the air's words win a tie", () => {
  const rainy = wx(() => 90, () => 9);
  // PM2.5 200 is band III: "stay" beats the weather's "limit", and keeps its words.
  assert.deepEqual(bestSlots(hourly(() => 200), "run", "healthy", NOW, 1, rainy)[0].rating, { tone: "stay", text: "Better indoors" });
  // Band II kids' play is "limit" like the rain: the air's words stay.
  assert.deepEqual(bestSlots(hourly(() => 100), "play", "healthy", NOW, 1, rainy)[0].rating, { tone: "limit", text: "Play indoors instead" });
  // Rain lifts band I's "go" to "limit" only because rain is worse than good air.
  assert.equal(bestSlots(hourly(() => 20), "play", "healthy", NOW, 1, rainy)[0].rating.text, RAIN_TEXT);
});

test("with the same rating and air, the cooler feels-like wins", () => {
  const h = hourly(() => 20);
  const [today] = bestSlots(h, "run", "healthy", NOW, 1, wx(() => 0, () => 0, (i) => (i === 3 ? 27 : 32)));
  assert.equal(today.startIndex, 3);
  assert.equal(today.feelsLike, 27);
});

test("the strip rates each hour on air, rain and UV together, keeps the air's own tone for the bar's colour and marks the rainy and sunny hours", () => {
  const h = hourly(() => 20);
  const strip = planStrip(h, "run", "healthy", NOW, wx((i) => (i === 2 ? 70 : 10), (i) => (i === 3 ? 9 : 1)));
  assert.equal(strip[2].rainy, true);
  assert.equal(strip[2].rating.text, RAIN_TEXT);
  assert.equal(strip[2].air, "go"); // the rain makes the answer "limit", but the air is fine: the bar stays the air's colour
  assert.equal(strip[3].uvHigh, true);
  assert.equal(strip[2].uvHigh, false);
  assert.equal(strip[3].rainy, false);
  assert.equal(strip[3].rating.text, "Very high UV");
  assert.equal(strip[3].air, "go");
  assert.equal(strip[4].rating.tone, "go");
  assert.equal(planStrip(h, "run", "healthy", NOW)[2].rainProb, null);
});

test("the reason line gives rain, UV and air", () => {
  const [dry] = bestSlots(hourly(() => 20), "run", "healthy", NOW, 1, wx(() => 5, () => 3));
  assert.equal(slotReason(dry), "Dry · UV 3 · Air normal");
  const [wet] = bestSlots(hourly(() => 20), "run", "healthy", NOW, 1, wx(() => 60, () => 3));
  assert.equal(slotReason(wet), "Rain likely · UV 3 · Air normal");
  assert.equal(slotReason(bestSlots(hourly(() => 80), "run", "healthy", NOW)[0]), "Air elevated");
});

test("the best-time line names the day and hours, and says Now when the session starts this hour", () => {
  const h = hourly((i) => (i === 3 ? 10 : 20));
  const [today] = bestSlots(h, "run", "healthy", NOW);
  assert.deepEqual(bestTimeLine(today, "run", NOW), { text: "Cleanest air to run: today 9–10am", detail: "PM2.5 about 10 · Normal" });
  const [first] = bestSlots(hourly((i) => (i === 0 ? 10 : 20)), "run", "healthy", NOW);
  assert.deepEqual(bestTimeLine(first, "run", NOW), { text: "Cleanest air to run: now till 7am", detail: "PM2.5 about 10 · Normal" });
  const [tomorrow] = bestSlots(hourly(() => 20), "play", "healthy", NOW).slice(1);
  assert.match(bestTimeLine(tomorrow, "play", NOW).text, /^Cleanest air to take the kids out to play: tomorrow /);
});

test("the best-time line reads the same for a poor session, and ends on the half hour when the session does", () => {
  const [bad] = bestSlots(hourly(() => 300), "out", "healthy", NOW);
  assert.match(bestTimeLine(bad, "out", NOW).text, /^Cleanest air to go out: (now till |today )/);
  const [half] = bestSlots(hourly((i) => (i === 3 ? 10 : 20)), "football", "healthy", NOW);
  assert.equal(fmtSlot(half), "9:00–10:30am");
});

test("the plan's slot ignores hours past the strip, like the card", () => {
  // Clean only from hour 30 (noon tomorrow), beyond the 16-hour strip.
  const h = hourly((i) => (i === 30 ? 5 : 40));
  const strip = planStrip(h, "run", "healthy", NOW);
  const slot = planSlot(h, strip, "run", "healthy", NOW, 1, []);
  assert.ok(slot && slot.startIndex < PLAN_HOURS);
  assert.equal(planSlot(h, [], "run", "healthy", NOW, 1, []), undefined);
});
