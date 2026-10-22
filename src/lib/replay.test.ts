import assert from "node:assert/strict";
import { test } from "node:test";
import { aheadParts, newFires, newZonesText, trailCaption, windAtSg, windText } from "@/lib/replay";
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

test("windAtSg turns u=-5,v=5 m/s into a southeast wind of 25 km/h", () => {
  const cells = [-5, -5, -5, -5];
  const wind = windAtSg({ lats: [0, 2], lons: [103, 104] }, { u: cells, v: cells.map(() => 5) });
  assert.deepEqual(wind, { from: "southeast", kmh: 25 });
});

test("trailCaption: past and forecast wording; a forecast day has no fires to name", () => {
  const d = { from: "southeast", area: "Riau", near: 1200 };
  assert.equal(trailCaption(d), "Air came from the southeast via Riau, past 1,200 fires.");
  assert.equal(trailCaption(d, true), "Air should come from the southeast.");
  assert.equal(trailCaption({ from: null, area: null, near: 0 }), "Light winds: the air stayed around Singapore.");
  assert.equal(trailCaption({ from: null, area: null, near: 0 }, true), "Light winds: the air should stay around Singapore.");
});

test("aheadParts: null unless smoke reaches Singapore; strongest is left out for fewer than 150 fires", () => {
  const base = { fires: 12, checked: 150, area: "Riau", hours: 38, at: "2026-10-24T12:00:00.000Z", path: [] as [number, number][] };
  const p = aheadParts(base)!;
  assert.equal(p.reach, "Smoke from 12 of today's 150 strongest fires should reach Singapore in about 38 hours.");
  assert.equal(p.source, "Most of it comes from Riau.");
  assert.match(p.expected, /^Expected around /);
  assert.equal(aheadParts({ ...base, hours: null, at: null }), null);
  assert.equal(aheadParts({ ...base, fires: 0 }), null);
  assert.match(aheadParts({ ...base, checked: 40, area: null })!.reach, /of today's 40 fires/);
});

test("newZonesText and windText", () => {
  assert.equal(newZonesText(1), "1 new fire zone");
  assert.equal(newZonesText(4), "4 new fire zones");
  assert.equal(windText({ from: "southwest", kmh: 12 }), "Wind from the southwest, 12 km/h");
});
