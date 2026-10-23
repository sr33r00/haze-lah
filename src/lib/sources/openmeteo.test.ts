import assert from "node:assert/strict";
import { test } from "node:test";
import { dayAQ, fetchSmokeGrid, gridFrames, gasFrames } from "@/lib/sources/openmeteo";

// Two grid points, six hourly steps; the frames used are every third hour (indexes 0 and 3).
const time = ["2026-10-23T00:00", "2026-10-23T01:00", "2026-10-23T02:00", "2026-10-23T03:00", "2026-10-23T04:00", "2026-10-23T05:00"];
const point = (pm2_5: (number | null)[], ozone: (number | null)[]) => ({ hourly: { time, pm2_5, ozone, dust: [null, null, null, null, null, null] } });
const aq = [point([10.4, 0, 0, 20.6, 0, 0], [80, 0, 0, 91.5, 0, 0]), point([30, 0, 0, null, 0, 0], [70, 0, 0, 60, 0, 0])];

test("gridFrames picks the 3-hourly indexes", () => {
  // Rounded to integers; a null cell is 0, as in the PM2.5 grid.
  assert.deepEqual(gridFrames(aq, [0, 3], "pm2_5"), [[10, 30], [21, 0]]);
  assert.deepEqual(gridFrames(aq, [0, 3], "ozone"), [[80, 70], [92, 60]]);
});

test("gridFrames returns null when every value is null", () => {
  assert.equal(gridFrames(aq, [0, 3], "dust"), null);
});

test("missing gas leaves gases without that key", () => {
  const gases = gasFrames(aq, [0, 3]);
  assert.deepEqual(Object.keys(gases).sort(), ["o3"]);
  assert.deepEqual(gases.o3, [[80, 70], [92, 60]]);
  assert.equal("dust" in gases, false);
  assert.equal("pm10" in gases, false);
});

test("dayAQ takes the 8 three-hourly frames of an SGT day and keeps PM2.5", () => {
  // Two UTC days of hourly values; the value is the hour's index, so the picked frames can be read off.
  const times = Array.from({ length: 48 }, (_, h) => `2026-10-${h < 24 ? "19" : "20"}T${String(h % 24).padStart(2, "0")}:00`);
  const ramp = times.map((_, h) => h);
  const points = [{ hourly: { time: times, pm2_5: ramp, ozone: ramp.map((h) => h + 0.4) } }];
  const day = dayAQ(points, [0], [100], "2026-10-20");
  // SGT 00:00 on the 20th is 16:00 UTC on the 19th (index 16), then every 3 hours.
  assert.deepEqual(day.times, ["2026-10-19T16:00:00.000Z", "2026-10-19T19:00:00.000Z", "2026-10-19T22:00:00.000Z", "2026-10-20T01:00:00.000Z", "2026-10-20T04:00:00.000Z", "2026-10-20T07:00:00.000Z", "2026-10-20T10:00:00.000Z", "2026-10-20T13:00:00.000Z"]);
  assert.deepEqual(day.values.pm25, [[16], [19], [22], [25], [28], [31], [34], [37]]);
  assert.deepEqual(day.values.o3, [[16], [19], [22], [25], [28], [31], [34], [37]]);
  assert.equal("co" in day.values, false);
});

test("dayAQ throws when the answer does not cover the SGT day", () => {
  const points = [{ hourly: { time: ["2026-10-20T00:00", "2026-10-20T01:00"], pm2_5: [1, 2] } }];
  assert.throws(() => dayAQ(points, [0], [100], "2026-10-20"), /cover/);
});

test("a PM2.5 outage gives no PM2.5 frames, not a grid of zeros that reads as clean air; the gases still come", async () => {
  const start = Math.floor(Date.now() / 3600_000) * 3600_000;
  const hours = Array.from({ length: 96 }, (_, h) => new Date(start + h * 3600_000).toISOString().slice(0, 16));
  const body = [{ hourly: { time: hours, pm2_5: hours.map(() => null), ozone: hours.map(() => 80) } }];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => (String(url).includes("air-quality") ? new Response(JSON.stringify(body)) : new Response("", { status: 500 }))) as typeof fetch;
  try {
    const grid = await fetchSmokeGrid();
    assert.deepEqual(grid.values, []);
    assert.ok(grid.times.length > 0);
    assert.equal(grid.gases.o3?.length, grid.times.length);
    assert.equal(grid.wind, null);
  } finally {
    globalThis.fetch = real;
  }
});
