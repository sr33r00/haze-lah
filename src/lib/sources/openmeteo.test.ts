import assert from "node:assert/strict";
import { test } from "node:test";
import { gridFrames, gasFrames } from "@/lib/sources/openmeteo";

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
