import assert from "node:assert/strict";
import { test } from "node:test";
import { REGIONS, REGION_POINT, type Region } from "@/lib/bands";
import { bandColor, dotFeatures, readingDots } from "@/lib/readings";
import type { HazeData, Sensor, Station } from "@/lib/types";

const NOW = Date.parse("2026-10-23T06:00:00Z");
const all = (n: number) => Object.fromEntries(REGIONS.map((r) => [r, n])) as Record<Region, number>;

const station = (over: Partial<Station>): Station => ({ id: "s", name: "Kuala Lumpur", state: "KL", country: "MY", lat: 3.1, lon: 101.7, api: 61, pm25: 38, time: null, distanceKm: 300, ...over });
const sensor = (over: Partial<Sensor> = {}): Sensor => ({ name: "Bishan", lat: 1.35, lon: 103.85, pm25: 70, time: new Date(NOW - 3600_000).toISOString(), ...over });

const data = (over: Partial<HazeData> = {}): HazeData =>
  ({
    nea: {
      time: "2026-10-23T14:00:00+08:00",
      psi24: all(60),
      pm25_24h: all(20),
      pm10_24h: all(30),
      sub: { pm25: all(55), pm10: all(30), o3: { ...all(20), central: 42 }, so2: all(5), co: all(8) },
      no2_1h_max: all(30),
    },
    history: { regions: Object.fromEntries(REGIONS.map((r) => [r, [{ time: "t0", value: 90 }, { time: "t1", value: 38.4 }]])) as never, island: [] },
    stations: [station({}), station({ id: "p", name: "Pekanbaru", country: "ID", api: null, pm25: 210, lat: 0.51, lon: 101.45 })],
    sensors: [sensor()],
    ...over,
  }) as HazeData;

test("no dots on a past day", () => {
  assert.deepEqual(readingDots(data(), "pm25", false, NOW), []);
});

test("no dots on dust, smoke or off", () => {
  for (const l of ["dust", "smoke", "off"] as const) assert.deepEqual(readingDots(data(), l, true, NOW), []);
});

test("NEA central shows the O3 sub-index on the O3 layer", () => {
  const d = readingDots(data(), "o3", true, NOW).find((x) => x.label === "Central, NEA")!;
  assert.equal(d.value, "PSI sub-index 42 (O₃)");
  assert.equal(d.band, 0);
  assert.equal(d.kind, "measured");
  assert.deepEqual([d.lat, d.lon], REGION_POINT.central);
});

test("NEA shows the latest 1-hour PM2.5 on the PM2.5 layer, banded by bandOf", () => {
  const d = readingDots(data(), "pm25", true, NOW).find((x) => x.label === "North, NEA")!;
  assert.equal(d.value, "38 µg/m³ PM2.5");
  assert.equal(d.band, 0);
});

test("NEA sub-index bands follow PSI 50, 100 and 200", () => {
  const d = data();
  d.nea!.sub.pm10 = { north: 50, south: 51, east: 100, west: 101, central: 201 };
  const band = (r: string) => readingDots(d, "pm10", true, NOW).find((x) => x.label === `${r}, NEA`)!.band;
  assert.deepEqual(["North", "South", "East", "West", "Central"].map(band), [0, 1, 1, 2, 3]);
});

test("NEA shows the NO2 concentration on the NO2 layer, banded by bandOf", () => {
  const d = data();
  d.nea!.no2_1h_max = { ...all(10), east: 30 };
  const e = readingDots(d, "no2", true, NOW).find((x) => x.label === "East, NEA")!;
  assert.equal(e.value, "30 µg/m³ NO₂");
  assert.equal(e.band, 1); // above 25 (WHO 24-hour), at most 200
});

test("a Malaysian station shows PM2.5 on the CO layer, labelled PM2.5", () => {
  const d = readingDots(data(), "co", true, NOW).find((x) => x.label === "Kuala Lumpur, Malaysia")!;
  assert.equal(d.value, "38 µg/m³ PM2.5");
  assert.equal(d.kind, "measured");
  assert.equal(d.band, 0);
});

test("a Malaysian station with no PM2.5 shows its API, banded like PSI", () => {
  const d = readingDots(data({ stations: [station({ pm25: null, api: 161 })] }), "pm25", true, NOW).find((x) => x.label === "Kuala Lumpur, Malaysia")!;
  assert.equal(d.value, "API 161");
  assert.equal(d.band, 2);
});

test("a station with neither reading has no dot", () => {
  assert.equal(readingDots(data({ stations: [station({ pm25: null, api: null })] }), "pm25", true, NOW).filter((x) => x.label.endsWith("Malaysia")).length, 0);
});

test("Indonesian city is kind model", () => {
  const d = readingDots(data(), "pm25", true, NOW).find((x) => x.label === "Pekanbaru, Model")!;
  assert.equal(d.kind, "model");
  assert.equal(d.band, 2);
  assert.equal(d.value, "210 µg/m³ PM2.5");
});

test("sensors show PM2.5 and are dropped after 3 hours", () => {
  const fresh = readingDots(data(), "pm25", true, NOW).find((x) => x.label === "Bishan, Sensor")!;
  assert.equal(fresh.value, "70 µg/m³ PM2.5");
  assert.equal(fresh.band, 1);
  const old = data({ sensors: [sensor({ time: new Date(NOW - 3 * 3600_000 - 1).toISOString() })] });
  assert.equal(readingDots(old, "pm25", true, NOW).some((x) => x.label.endsWith("Sensor")), false);
});

test("no NEA data gives no NEA dots", () => {
  const d = readingDots(data({ nea: null, history: null }), "pm25", true, NOW);
  assert.equal(d.some((x) => x.label.endsWith("NEA")), false);
});

test("dot features carry the band colour; no band is grey", () => {
  const f = dotFeatures(readingDots(data(), "pm25", true, NOW));
  assert.equal(f.type, "FeatureCollection");
  assert.equal(f.features[0].properties!.color, bandColor(0));
  assert.notEqual(bandColor(0), bandColor(3));
  assert.equal(bandColor(null), "rgb(150,150,150)");
});
