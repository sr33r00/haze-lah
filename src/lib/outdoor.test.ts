import assert from "node:assert/strict";
import { test } from "node:test";
import { REGION_POINT } from "@/lib/bands";
import { feelsLikeNow, lightningNear, nearest, outdoorCells, shortForecast, uvCategory } from "@/lib/outdoor";
import type { OutdoorFeeds, WeatherHour } from "@/lib/types";

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
  temp: { time: iso(NOW - 2 * MIN), stations: [{ name: "East Coast Parkway", lat: 1.3135, lon: 103.9625, temp: 31.44 }] },
  uv: { readings: [{ hour: "2026-10-26T14:00:00+08:00", value: 5 }, { hour: "2026-10-26T13:00:00+08:00", value: 5 }] },
  lightning: { time: iso(NOW - 2 * MIN), strikes: [] },
  ...over,
});

test("the tiles show the nearest station's temperature, the last UV, the nearest town's forecast and lightning", () => {
  const c = outdoorCells(feeds(), "east", NOW, 36.2);
  assert.equal(c.temp?.value, "31°");
  assert.equal(c.temp?.sub, "Feels 36°");
  assert.equal(c.temp?.warn, undefined);
  assert.match(c.temp?.detail ?? "", /^31\.4 °C measured at East Coast Parkway at 1:58pm\. Feels like 36 °C \(Open-Meteo model\)\. Heat stress Low · WBGT 25\.2 °C at Bedok Stadium\./);
  assert.deepEqual([c.uv?.value, c.uv?.sub, c.uv?.warn], ["5", "Moderate", undefined]);
  assert.deepEqual([c.rain?.value, c.rain?.sub], ["Storms", "till 3pm"]);
  assert.match(c.rain?.detail ?? "", /^Thundery Showers in Bedok till 3pm\./);
  assert.deepEqual([c.lightning?.value, c.lightning?.sub, c.lightning?.warn], ["None", "15 km", undefined]);
});

test("high heat stress replaces the feels-like line, and a missing measurement falls back to the feels-like", () => {
  const hot = { time: iso(NOW - 5 * MIN), stations: [{ id: "S129", town: "Bedok Stadium", lat: 1.3257, lon: 103.9397, wbgt: 33.1, stress: "High" }] };
  const c = outdoorCells(feeds({ heat: hot }), "east", NOW, 36).temp;
  assert.deepEqual([c?.value, c?.sub, c?.warn], ["31°", "Heat high", "sub"]);
  const noTemp = outdoorCells(feeds({ temp: null }), "east", NOW, 36).temp;
  assert.deepEqual([noTemp?.value, noTemp?.sub], ["36°", "Feels like"]);
  assert.equal(outdoorCells(feeds({ temp: null }), "east", NOW).temp, null);
  assert.equal(outdoorCells(null, "east", NOW, 33).temp?.value, "33°");
  assert.equal(outdoorCells(feeds({ temp: { time: iso(NOW - 40 * MIN), stations: [{ name: "x", lat: 1.31, lon: 103.96, temp: 30 }] } }), "east", NOW).temp, null);
});

test("UV from Very high is a warning", () => {
  const uv = (value: number) => outdoorCells(feeds({ uv: { readings: [{ hour: "2026-10-26T14:00:00+08:00", value }] } }), "east", NOW).uv;
  assert.equal(uv(7)?.warn, undefined);
  assert.deepEqual([uv(9)?.value, uv(9)?.sub, uv(9)?.warn], ["9", "Very high", "value"]);
});

test("forecast texts shrink to a word or two by keyword", () => {
  const cases: [string, string][] = [
    ["Thundery Showers", "Storms"],
    ["Heavy Thundery Showers with Gusty Winds", "Heavy storms"],
    ["Heavy Rain", "Heavy rain"],
    ["Light Rain", "Light rain"],
    ["Light Showers", "Light rain"],
    ["Passing Showers", "Rain"],
    ["Partly Cloudy (Day)", "Partly cloudy"],
    ["Cloudy", "Cloudy"],
    ["Hazy", "Hazy"],
    ["Mist", "Misty"],
    ["Windy", "Windy"],
    ["Fair (Night)", "Fair"],
    ["Something New (Day)", "Something New"],
  ];
  for (const [text, short] of cases) assert.equal(shortForecast(text), short, text);
});

test("the feels-like is that of the forecast hour holding now", () => {
  const hour = (h: number, feelsLike: number | null): WeatherHour => ({ time: `2026-10-26T${h}:00:00+08:00`, windDir: 0, windSpeed: 0, rainProb: null, rain: null, gust: null, uv: null, feelsLike });
  assert.equal(feelsLikeNow([hour(13, 33), hour(14, 35), hour(15, 36)], NOW + 20 * MIN), 35);
  assert.equal(feelsLikeNow([hour(15, 36)], NOW), null); // only later hours: none holds now
  assert.equal(feelsLikeNow([hour(14, null)], NOW), null);
  assert.equal(feelsLikeNow([], NOW), null);
});

test("a strike nearby is a warning with the nearest distance", () => {
  const [lat, lon] = REGION_POINT.east;
  const lightning = { time: iso(NOW - 2 * MIN), strikes: [{ t: NOW - 4 * MIN, lat: lat + 0.045, lon }, { t: NOW - 8 * MIN, lat: lat + 0.09, lon }] };
  const c = outdoorCells(feeds({ lightning }), "east", NOW).lightning;
  assert.equal(c?.warn, "tile");
  assert.equal(c?.value, "2 strikes");
  assert.equal(c?.sub, "5 km");
  assert.match(c?.detail ?? "", /Nearest 5 km, latest 1:56pm\.$/);
  assert.equal(outdoorCells(feeds({ lightning: { ...lightning, strikes: lightning.strikes.slice(0, 1) } }), "east", NOW).lightning?.value, "1 strike");
});

test("a failed or stale source is unavailable, never a value", () => {
  const c = outdoorCells(
    feeds({
      rain: { start: iso(NOW - 150 * MIN), end: iso(NOW - 30 * MIN), areas: [{ name: "Bedok", lat: 1.321, lon: 103.924, forecast: "Cloudy" }] },
      temp: { time: iso(NOW - 3 * 3600_000), stations: [{ name: "East Coast Parkway", lat: 1.3135, lon: 103.9625, temp: 31 }] },
      uv: null,
      lightning: { time: iso(NOW - 25 * MIN), strikes: [] },
    }),
    "east",
    NOW,
  );
  assert.deepEqual(c, { temp: null, uv: null, rain: null, lightning: null });
});

test("at night UV says Night when the last hour was 0 or there is none", () => {
  const night = Date.parse("2026-10-26T22:00:00+08:00");
  const zero = outdoorCells(feeds({ uv: { readings: [{ hour: "2026-10-26T19:00:00+08:00", value: 0 }] } }), "east", night).uv;
  assert.deepEqual([zero?.value, zero?.sub], ["Night", "Last 7pm"]);
  assert.equal(outdoorCells(feeds({ uv: { readings: [] } }), "east", Date.parse("2026-10-27T03:00:00+08:00")).uv?.value, "Night");
  // by day an empty list or a 0 is not "Night"
  assert.equal(outdoorCells(feeds({ uv: { readings: [] } }), "east", NOW).uv, null);
  assert.equal(outdoorCells(feeds({ uv: { readings: [{ hour: "2026-10-26T14:00:00+08:00", value: 0 }] } }), "east", NOW).uv?.sub, "Low");
});
