import assert from "node:assert/strict";
import { test } from "node:test";
import { GRID_BOX, boxPixels, coverZoom } from "./modelGrid";

test("the grid box is the fetched grid", () => {
  assert.deepEqual(GRID_BOX, [[-6, 95], [7, 120]]);
});

test("a box covers the map at the cover zoom and not at the step below", () => {
  const b = boxPixels(GRID_BOX);
  for (const [w, h] of [[390, 300], [900, 800], [1400, 900], [600, 1200]]) {
    const z = coverZoom(GRID_BOX, w, h);
    assert.equal(z % 0.5, 0);
    assert.ok(b.w * 2 ** z >= w && b.h * 2 ** z >= h, `${w}x${h} at ${z}`);
    const below = z - 0.5;
    assert.ok(b.w * 2 ** below < w || b.h * 2 ** below < h, `${w}x${h} at ${below}`);
  }
});

test("a bigger or taller map needs a closer zoom", () => {
  assert.ok(coverZoom(GRID_BOX, 1800, 300) > coverZoom(GRID_BOX, 900, 300));
  assert.ok(coverZoom(GRID_BOX, 900, 1800) > coverZoom(GRID_BOX, 900, 900));
});

test("the snap is respected and a box exactly on a zoom is not pushed up", () => {
  const b = boxPixels(GRID_BOX);
  assert.equal(coverZoom(GRID_BOX, b.w * 2 ** 6, 1), 6);
  assert.equal(coverZoom(GRID_BOX, b.w * 2 ** 6 + 1, 1, 1), 7);
});
