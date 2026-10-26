import assert from "node:assert/strict";
import { test } from "node:test";
import { REGION_POINT } from "@/lib/bands";
import { lightningNear, nearest, outdoorCells, uvCategory } from "@/lib/outdoor";
import type { OutdoorFeeds } from "@/lib/types";

const NOW = Date.parse("2026-10-26T14:00:00+08:00");
const MIN = 60_000;
const iso = (t: number) => new Date(t).toISOString();

test("UV categories follow WHO: 0-2 Low, 3-5 Moderate, 6-7 High, 8-10 Very high, 11+ Extreme", () => {
  const names = [0, 2, 3, 5, 6, 7, 8, 10, 11, 14].map(uvCategory);
  assert.deepEqual(names, ["Low", "Low", "Moderate", "Moderate", "High", "High", "Very high", "Very high", "Extreme", "Extreme"]);
});

test("nearest picks the closest item to a point", () => {
  const items = [
    { n: "Woodlands", lat: 1.437, lon: 103.786 },
    { n: "Bedok", lat: 1.321, lon: 103.924 },
  ];
  assert.equal(nearest(items, REGION_POINT.east)?.n, "Bedok");
  assert.equal(nearest(items, REGION_POINT.north)?.n, "Woodlands");
  assert.equal(nearest([], REGION_POINT.north), null);
});

test("lightning counts strikes within 15 km and 30 minutes of now", () => {
  const [lat, lon] = REGION_POINT.central;
  const strikes = [
    { t: NOW - 5 * MIN, lat: lat + 0.05, lon }, // about 5.6 km
    { t: NOW - 29 * MIN, lat, lon }, // 0 km
    { t: NOW - 31 * MIN, lat, lon }, // too old
    { t: NOW - 2 * MIN, lat: lat + 0.2, lon }, // about 22 km
  ];
  const r = lightningNear(strikes, REGION_POINT.central, NOW);
  assert.equal(r.count, 2);
  assert.equal(r.nearestKm, 0);
  assert.equal(r.latest, NOW - 5 * MIN);
  assert.deepEqual(lightningNear([], REGION_POINT.central, NOW), { count: 0, nearestKm: null, latest: null });
});

const feeds = (over: Partial<OutdoorFeeds> = {}): OutdoorFeeds => ({
  rain: { start: iso(NOW - 10 * MIN), end: iso(NOW + 110 * MIN), areas: [{ name: "Bedok", lat: 1.321, lon: 103.924, forecast: "Thundery Showers" }] },
  heat: { time: iso(NOW - 5 * MIN), stations: [{ id: "S129", town: "Bedok Stadium", lat: 1.3257, lon: 103.9397, wbgt: 25.24, stress: "Low" }] },
  uv: { readings: [{ hour: "2026-10-26T14:00:00+08:00", value: 5 }, { hour: "2026-10-26T13:00:00+08:00", value: 5 }] },
  lightning: { time: iso(NOW - 2 * MIN), strikes: [] },
  ...over,
});

test("the cells show the nearest town's forecast, the nearest station's heat stress, the last UV and lightning", () => {
  const c = outdoorCells(feeds(), "east", NOW);
  assert.deepEqual(c.rain, { value: "Thundery Showers", sub: "Bedok · till 3pm" });
  assert.deepEqual(c.heat, { value: "Low · 25.2°", sub: "Bedok Stadium · 1:55pm" });
  assert.deepEqual(c.uv, { value: "5 · Moderate", sub: "Island-wide · 2pm" });
  assert.deepEqual(c.lightning, { value: "None nearby", sub: "Within 15 km · last 30 min" });
});

test("a strike nearby is a warning with the nearest distance", () => {
  const [lat, lon] = REGION_POINT.east;
  const lightning = { time: iso(NOW - 2 * MIN), strikes: [{ t: NOW - 4 * MIN, lat: lat + 0.045, lon }, { t: NOW - 8 * MIN, lat: lat + 0.09, lon }] };
  const c = outdoorCells(feeds({ lightning }), "east", NOW).lightning;
  assert.equal(c?.warn, true);
  assert.equal(c?.value, "2 strikes nearby");
  assert.equal(c?.sub, "Nearest 5 km · 1:56pm");
  assert.equal(outdoorCells(feeds({ lightning: { ...lightning, strikes: lightning.strikes.slice(0, 1) } }), "east", NOW).lightning?.value, "1 strike nearby");
});

test("a failed or stale source is unavailable, never a value", () => {
  const c = outdoorCells(
    feeds({
      rain: { start: iso(NOW - 150 * MIN), end: iso(NOW - 30 * MIN), areas: [{ name: "Bedok", lat: 1.321, lon: 103.924, forecast: "Cloudy" }] },
      heat: { time: iso(NOW - 3 * 3600_000), stations: [{ id: "S129", town: "Bedok Stadium", lat: 1.3257, lon: 103.9397, wbgt: 25, stress: "Low" }] },
      uv: null,
      lightning: { time: iso(NOW - 25 * MIN), strikes: [] },
    }),
    "east",
    NOW,
  );
  assert.deepEqual(c, { rain: null, heat: null, uv: null, lightning: null });
});

test("at night UV says Night when the last hour was 0 or there is none", () => {
  const night = Date.parse("2026-10-26T22:00:00+08:00");
  const zero = outdoorCells(feeds({ uv: { readings: [{ hour: "2026-10-26T19:00:00+08:00", value: 0 }] } }), "east", night).uv;
  assert.deepEqual(zero, { value: "Night", sub: "Last reading 7pm" });
  assert.equal(outdoorCells(feeds({ uv: { readings: [] } }), "east", Date.parse("2026-10-27T03:00:00+08:00")).uv?.value, "Night");
  // by day an empty list or a 0 is not "Night"
  assert.equal(outdoorCells(feeds({ uv: { readings: [] } }), "east", NOW).uv, null);
  assert.equal(outdoorCells(feeds({ uv: { readings: [{ hour: "2026-10-26T14:00:00+08:00", value: 0 }] } }), "east", NOW).uv?.value, "0 · Low");
});
