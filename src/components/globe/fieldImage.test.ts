import assert from "node:assert/strict";
import { test } from "node:test";
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

test("pale low values are cleared, thick smoke and empty pixels stay", () => {
  // AI 0.5 (226,226,169), 1.5 (246,246,28), 2.0 (237,235,0), 3.0 (231,104,0), 5.0 (115,0,25), and a pixel with no data.
  const px = new Uint8ClampedArray([226, 226, 169, 255, 246, 246, 28, 255, 237, 235, 0, 255, 231, 104, 0, 255, 115, 0, 25, 255, 0, 0, 0, 0]);
  clearNoise(px);
  assert.deepEqual([...px].filter((_, i) => i % 4 === 3), [0, 0, 255, 255, 255, 0]);
});
