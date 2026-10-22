import assert from "node:assert/strict";
import { test } from "node:test";
import { newFires, windAtSg } from "@/lib/replay";
import type { ReplayDay } from "@/lib/types";

/** A day with only the fires filled in; newFires reads nothing else. */
const day = (fires: [number, number][]) => ({ fires }) as ReplayDay;

test("newFires returns [] without earlier days", () => {
  assert.deepEqual(newFires([day([[0, 110]])]), []);
});

test("newFires ignores a fire within 50 km of an earlier fire", () => {
  assert.deepEqual(newFires([day([[0, 110]]), day([[0.3, 110]])]), []);
});

test("newFires keeps one ring per 30 km", () => {
  const zones = newFires([day([[-5, 120]]), day([[3, 100], [3.1, 100]])]);
  assert.equal(zones.length, 1);
});

test("windAtSg turns u=-5,v=5 m/s into a south-east wind of 25 km/h", () => {
  const cells = [-5, -5, -5, -5];
  const wind = windAtSg({ lats: [0, 2], lons: [103, 104] }, { u: cells, v: cells.map(() => 5) });
  assert.deepEqual(wind, { from: "southeast", kmh: 25 });
});
