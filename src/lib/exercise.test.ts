import assert from "node:assert/strict";
import { test } from "node:test";
import { bestSlots, planStrip, rate, ratingLegend } from "@/lib/exercise";
import type { ForecastPoint } from "@/lib/types";

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
  const strip = planStrip(h, "run", "healthy", bestSlots(h, "run", "healthy", now), now);
  assert.equal(strip[0].time, h[3].time);
});

test("the strip runs to the end of tomorrow's slot, or 24 hours without one", () => {
  const h = hourly((i) => (i < 30 ? 100 : 10)); // tomorrow is cleanest from 12pm (index 30)
  const slots = bestSlots(h, "run", "healthy", NOW);
  const strip = planStrip(h, "run", "healthy", slots, NOW);
  assert.equal(strip.length, 31);
  const tomorrow = slots.find((s) => s.day === "tomorrow")!;
  assert.ok(Date.parse(strip[strip.length - 1].time) + 3600_000 >= Date.parse(tomorrow.end));
  assert.equal(planStrip(h, "run", "healthy", [], NOW).length, 24);
});

test("the strip is capped at 48 hours", () => {
  const h = hourly(() => 20, undefined, 72);
  const [today] = bestSlots(h, "run", "healthy", NOW);
  const far = { ...today, day: "tomorrow" as const, end: new Date(START + 60 * 3600_000).toISOString() };
  assert.equal(planStrip(h, "run", "healthy", [far], NOW).length, 48);
});

test("the strip keeps 24 hours when tomorrow's slot ends sooner", () => {
  // In the evening tomorrow's early run (ending 5 hours from now) must not shrink the strip.
  const h = hourly(() => 20);
  const [today] = bestSlots(h, "run", "healthy", NOW);
  const early = { ...today, day: "tomorrow" as const, end: new Date(START + 5 * 3600_000).toISOString() };
  assert.equal(planStrip(h, "run", "healthy", [early], NOW).length, 24);
});

test("each strip hour carries the chosen activity's rating", () => {
  const h = hourly((i) => 20 + i * 5);
  const run = planStrip(h, "run", "healthy", [], NOW);
  run.forEach((s, i) => assert.deepEqual(s.rating, rate(h[i].pm25, "run", "healthy")));
  const out = planStrip(h, "out", "healthy", [], NOW);
  assert.notDeepEqual(run[16].rating, out[16].rating); // PM2.5 100: "Better indoors" for a run, "Cut back" for going out
});

test("the legend lists the distinct answers of the activity, mildest first", () => {
  assert.deepEqual(ratingLegend("run", "healthy"), [
    { text: "Good to go", tones: ["go"] },
    { text: "Keep it short and easy", tones: ["easy"] },
    { text: "Better indoors", tones: ["stay"] },
  ]);
  // Kids play says the same words in band II and from band III, so both colours share one entry.
  assert.deepEqual(ratingLegend("play", "healthy"), [
    { text: "Good for outdoor play", tones: ["go"] },
    { text: "Play indoors instead", tones: ["limit", "stay"] },
  ]);
  assert.deepEqual(
    ratingLegend("out", "healthy").map((r) => r.text),
    ["Go ahead", "Cut back outdoors", "Keep outings short", "Stay in if you can"],
  );
  assert.deepEqual(
    ratingLegend("out", "sensitive").map((r) => r.text),
    ["Go ahead", "Keep outings short", "Stay indoors"],
  );
});
