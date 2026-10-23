import assert from "node:assert/strict";
import { test } from "node:test";
import { colorOf, pollutant, rampTop, POLLUTANTS } from "@/lib/pollutants";
import { clearNoise, fieldPixels, sampleGrid } from "./fieldImage";

const grid = { lats: [0, 1, 2, 3, 4, 5, 6], lons: [100, 101, 102, 103, 104, 105, 106] };
const clean = Array.from({ length: 49 }, () => 0);
/** Alpha at the middle of the picture. */
const middle = (v: { width: number; height: number; pixels: Uint8ClampedArray }) => v.pixels[((v.height >> 1) * v.width + (v.width >> 1)) * 4 + 3];

test("clean air is transparent and smoke is not", () => {
  assert.equal(middle(fieldPixels(grid, clean, "pm25")), 0);
  assert.ok(middle(fieldPixels(grid, clean.map(() => 200), "pm25")) > 100);
});

test("each pollutant is coloured by its own bands", () => {
  const v = clean.map(() => 100); // Very high CO is 17000, but 100 is nothing; PM2.5 100 is Elevated
  assert.equal(middle(fieldPixels(grid, v, "co")), 0);
  assert.ok(middle(fieldPixels(grid, v, "pm25")) > 0);
});

test("a missing cell reads as 0 and the field fades out at the grid's edge", () => {
  assert.equal(sampleGrid(grid, [NaN, ...clean.slice(1)], 0, 100), 0);
  const v = fieldPixels(grid, clean.map(() => 200), "pm25");
  assert.equal(v.pixels[3], 0); // the corner
});

test("a flat picture is the grid's own box, smoke to its edge", () => {
  const v = fieldPixels(grid, clean.map(() => 200), "pm25", 10);
  assert.equal(v.width, 60);
  assert.equal(v.height, 60);
  assert.ok(v.pixels[3] > 100); // the corner, which the Mercator picture fades out
});

test("pale low values are cleared, thick smoke and empty pixels stay", () => {
  // AI 0.5 (226,226,169), 1.5 (246,246,28), 2.0 (237,235,0), 3.0 (231,104,0), 5.0 (115,0,25), and a pixel with no data.
  const px = new Uint8ClampedArray([226, 226, 169, 255, 246, 246, 28, 255, 237, 235, 0, 255, 231, 104, 0, 255, 115, 0, 25, 255, 0, 0, 0, 0]);
  clearNoise(px);
  assert.deepEqual([...px].filter((_, i) => i % 4 === 3), [0, 0, 255, 255, 255, 0]);
});

test("the quick picture has the colours of sampleGrid and colorOf, pixel by pixel", () => {
  const lats = [-6, -5, -4, -3, -2, -1, 0, 1, 2];
  const lons = [95, 96, 97, 98, 99, 100, 101, 102, 103, 104];
  const data = lats.flatMap((_, r) => lons.map((_, c) => (r === 3 && c === 4 ? NaN : 20 + ((r * 37 + c * 91) % 17) * 30))); // a missing cell too
  const g = { lats, lons };
  for (const id of ["pm25", "co", "dust"] as const) {
    const { width, height, pixels } = fieldPixels(g, data, id, 10); // flat: row py is at a known latitude
    for (const [px, py] of [[3, 4], [width >> 1, height >> 1], [width - 5, height - 6], [47, 33], [61, 12]]) {
      const lat = 2 - ((py + 0.5) / height) * 8;
      const lon = 95 + ((px + 0.5) / width) * 9;
      const want = colorOf(pollutant(id), sampleGrid(g, data, lat, lon));
      const at = (py * width + px) * 4;
      [0, 1, 2].forEach((k) => assert.ok(Math.abs(pixels[at + k] - want[k]) <= 2, `${id} ${px},${py} channel ${k}`));
      assert.ok(Math.abs(pixels[at + 3] - want[3] * 255) <= 2, `${id} ${px},${py} alpha`);
    }
  }
});

test("a smaller picture is the same field in fewer pixels", () => {
  const v = clean.map(() => 200);
  const big = fieldPixels(grid, v, "pm25", undefined, 48);
  const small = fieldPixels(grid, v, "pm25", undefined, 24);
  assert.equal(small.width * 2, big.width);
  assert.ok(Math.abs(small.height * 2 - big.height) <= 1);
  assert.ok(small.pixels.length < big.pixels.length / 3.9);
});

test("no pollutant's colour changes above its ramp's top", () => {
  for (const p of POLLUTANTS) assert.deepEqual(colorOf(p, rampTop(p)), colorOf(p, rampTop(p) * 3), p.id);
});
