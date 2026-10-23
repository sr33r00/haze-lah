import assert from "node:assert/strict";
import { test } from "node:test";
import { aheadParts, newFires, newZonesText, trailCaption, windAtSg, windOutlook, windText } from "@/lib/replay";
import type { WindFrame } from "@/lib/wind";

/** A day with only the fires filled in; newFires reads nothing else. */
const day = (fires: [number, number][]) => ({ fires });

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
  assert.equal(trailCaption({ ...d, near: 1 }), "Air came from the southeast via Riau, past 1 fire.");
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

test("newFires takes plain {fires} days, with extra values per fire", () => {
  const zones = newFires([{ fires: [[0, 110, 40]] }, { fires: [[5, 120, 80]] }]);
  assert.deepEqual(zones, [[5, 120]]);
});

const H = 3600_000;
const NOW = Date.parse("2026-10-23T04:00:00Z"); // 12:00 SGT

/** Uniform wind (m/s, u towards the east, v towards the north) on a grid around Singapore, every 3 hours from 7 days back to `ahead` hours on. */
function uniform(u: number, v: number, ahead = 96): WindFrame[] {
  const lats = Array.from({ length: 31 }, (_, i) => -15 + i);
  const lons = Array.from({ length: 31 }, (_, i) => 90 + i);
  const field = (x: number) => ({ lats, lons, data: lats.flatMap(() => lons.map(() => x)) });
  const n = (7 * 24 + ahead) / 3;
  return Array.from({ length: n + 1 }, (_, k) => ({ t: NOW - 7 * 24 * H + k * 3 * H, u: field(u), v: field(v) }));
}

/** A fire detected `hoursAgo` hours before NOW. */
const fire = (lat: number, lon: number, hoursAgo = 2) => ({ lat, lon, frp: 20, time: new Date(NOW - hoursAgo * H).toISOString(), confidence: "n" });

test("windOutlook: 24 steps on SGT 3-hour marks, from the next one after now", () => {
  const steps = windOutlook(uniform(4, 4), [], NOW);
  assert.equal(steps.length, 24);
  assert.equal(steps[0].t, "2026-10-23T07:00:00.000Z"); // 15:00 SGT
  assert.equal(steps.at(-1)!.t, "2026-10-26T04:00:00.000Z"); // +72 h
  assert.ok(steps.every((s, i) => i === 0 || Date.parse(s.t) - Date.parse(steps[i - 1].t) === 3 * H));
});

test("windOutlook: a south-west wind brings the air over fires to the south-west", () => {
  const [step] = windOutlook(uniform(4, 4), [fire(-2.5, 99.9), fire(-2.4, 100), fire(8, 118)], NOW);
  assert.equal(step.from, "southwest");
  assert.equal(step.deg, 225);
  assert.equal(step.kmh, 20); // 4 m/s east and north is 5.7 m/s
  assert.equal(step.near, 2);
  assert.equal(step.area, "West Sumatra");
});

test("windOutlook: a north-east wind leaves the same fires behind", () => {
  const [step] = windOutlook(uniform(-4, -4), [fire(-2.5, 99.9)], NOW);
  assert.equal(step.from, "northeast");
  assert.equal(step.deg, 45);
  assert.equal(step.near, 0);
  assert.equal(step.area, null);
});

test("windOutlook: fires older than 24 hours are not counted", () => {
  assert.equal(windOutlook(uniform(4, 4), [fire(-2.5, 99.9, 30)], NOW)[0].near, 0);
});

test("windOutlook: stops where the wind forecast ends, and has no steps without frames", () => {
  assert.equal(windOutlook(uniform(4, 4, 30), [], NOW).length, 10); // frames reach NOW + 30 h
  assert.deepEqual(windOutlook([], [], NOW), []);
});
