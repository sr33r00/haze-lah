import assert from "node:assert/strict";
import { test } from "node:test";
import { BAND_NAMES, POLLUTANTS, bandNames, bandOf, colorOf, rampCss } from "@/lib/pollutants";

const get = (id: string) => POLLUTANTS.find((p) => p.id === id)!;

test("pm25 at 30 is band 0 and alpha below 0.2", () => {
  const pm = get("pm25");
  assert.equal(bandOf(pm, 30), 0);
  assert.ok(colorOf(pm, 30)[3] < 0.2);
});

test("pm25 at 200 is band 2 and alpha above 0.6", () => {
  const pm = get("pm25");
  assert.equal(bandOf(pm, 200), 2);
  assert.ok(colorOf(pm, 200)[3] > 0.6);
});

test("pm25 below 20 is fully transparent", () => {
  assert.equal(colorOf(get("pm25"), 19.9)[3], 0);
  assert.equal(colorOf(get("pm25"), 0)[3], 0);
});

test("the Normal cut-off scales with each pollutant's first limit", () => {
  const o3 = get("o3");
  assert.equal(colorOf(o3, o3.bands![0] * 0.3)[3], 0);
  assert.ok(colorOf(o3, o3.bands![0])[3] > 0);
  assert.ok(colorOf(o3, o3.bands![0])[3] <= 0.16 + 1e-9);
});

test("band edges are inclusive, as NEA's PM2.5 bands are", () => {
  const pm = get("pm25");
  assert.deepEqual([55, 55.1, 150, 250, 250.1].map((v) => bandOf(pm, v)), [0, 1, 1, 2, 3]);
});

test("co uses µg/m³ (6000 is band 1)", () => {
  assert.equal(bandOf(get("co"), 6000), 1);
  assert.equal(bandOf(get("co"), 5000), 0);
});

test("dust has no bands and colorOf(dust, 400).a > 0.5", () => {
  const dust = get("dust");
  assert.equal(dust.bands, null);
  assert.ok(colorOf(dust, 400)[3] > 0.5);
  assert.equal(colorOf(dust, 0)[3], 0);
});

test("alpha never decreases with concentration and is held past the top", () => {
  for (const p of POLLUTANTS) {
    const top = p.bands ? p.bands[2] * 2 : 500;
    let last = 0;
    for (let i = 0; i <= 40; i++) {
      const a = colorOf(p, (top * i) / 20)[3];
      assert.ok(a >= last - 1e-9, `${p.id} alpha dips at step ${i}`);
      last = a;
    }
    assert.deepEqual(colorOf(p, top * 5), colorOf(p, top));
  }
});

test("every POLLUTANTS id is unique and has a source", () => {
  const ids = POLLUTANTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["pm25", "pm10", "co", "no2", "so2", "o3", "dust"]);
  for (const p of POLLUTANTS) {
    assert.ok(p.source.length > 0, p.id);
    assert.ok(p.camsVar.length > 0, p.id);
  }
});

test("bands rise strictly", () => {
  for (const p of POLLUTANTS) if (p.bands) assert.ok(p.bands[0] < p.bands[1] && p.bands[1] < p.bands[2], p.id);
});

test("band names: PM2.5 uses NEA's, others the PSI words", () => {
  assert.deepEqual(BAND_NAMES, ["Normal", "Elevated", "High", "Very high"]);
  assert.deepEqual(bandNames(get("pm25")), BAND_NAMES);
  assert.deepEqual(bandNames(get("so2")), ["Good", "Moderate", "Unhealthy", "Very unhealthy"]);
});

test("rampCss is a gradient", () => {
  for (const p of POLLUTANTS) assert.match(rampCss(p), /^linear-gradient\(to right, /);
});
