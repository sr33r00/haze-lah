import assert from "node:assert/strict";
import { test } from "node:test";
import { easeOut, flightLegs, poseAt, startPose, tilesAround } from "./flight";

const landing = { lng: 108.5, lat: -1, zoom: 3.6 };

test("tiles around Singapore are a few, in range and without repeats", () => {
  const tiles = tilesAround({ lng: 103.82, lat: 1.35 }, 4, 390, 844, 8);
  assert.ok(tiles.length > 0 && tiles.length <= 24);
  assert.ok(tiles.every((t) => t.z === 5 && t.x >= 0 && t.x < 32 && t.y >= 0 && t.y < 32));
  assert.equal(new Set(tiles.map((t) => `${t.x}/${t.y}`)).size, tiles.length);
  assert.ok(tiles.some((t) => t.x === 25 && t.y === 15)); // Singapore itself
});

test("tiles are capped, nearest first, and the level never passes the finest", () => {
  const near = tilesAround({ lng: 103.82, lat: 1.35 }, 4, 390, 844, 8, 5);
  assert.equal(near.length, 5);
  assert.ok(near.some((t) => t.x === 25 && t.y === 15));
  assert.equal(tilesAround({ lng: 0, lat: 0 }, 9, 390, 844, 8)[0].z, 8);
});

test("tiles wrap around the date line and the whole Earth is one level-0 tile", () => {
  const tiles = tilesAround({ lng: 179.9, lat: 0 }, 4, 390, 844, 8);
  assert.ok(tiles.some((t) => t.x === 0) && tiles.some((t) => t.x === 31));
  assert.deepEqual(tilesAround({ lng: 0, lat: 0 }, -1, 390, 844, 8), [{ z: 0, x: 0, y: 0 }]);
});

test("a first visit flies two legs from far out; the tilt waits for the descent", () => {
  const start = startPose(true);
  const legs = flightLegs(true, landing);
  assert.deepEqual(poseAt(start, legs, 0), { pose: start, tilt: 0 });
  assert.deepEqual(poseAt(start, legs, 2600).pose, { lng: 95, lat: 6, zoom: 1.7 });
  assert.equal(poseAt(start, legs, 2600 + 3400 * 0.4).tilt, 0);
  assert.ok(poseAt(start, legs, 2600 + 3400 * 0.7).tilt > 0);
  assert.deepEqual(poseAt(start, legs, 6000), { pose: landing, tilt: 1 });
  assert.deepEqual(poseAt(start, legs, 99999), { pose: landing, tilt: 1 });
});

test("a return visit goes straight in, and the descent eases out", () => {
  const start = startPose(false);
  const legs = flightLegs(false, landing);
  assert.equal(legs.length, 1);
  assert.deepEqual(poseAt(start, legs, 2400), { pose: landing, tilt: 1 });
  assert.ok(easeOut(0.5) > 0.5 && easeOut(1) === 1);
});
