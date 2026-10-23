import assert from "node:assert/strict";
import { test } from "node:test";
import { canvasRatio, particleCount } from "./windParticles";

test("a big screen gets no more than a few times a phone's particles, and a small one keeps the floor", () => {
  const phone = particleCount(390, 844);
  assert.equal(phone, 400);
  assert.ok(particleCount(1920, 1080) <= 4 * phone);
  assert.ok(particleCount(3840, 2160) <= 4 * phone);
  assert.ok(particleCount(1000, 700) < particleCount(1920, 1080));
});

test("the canvas follows the screen's sharpness up to 2, and is held to a pixel budget on a big screen", () => {
  assert.equal(canvasRatio(390, 844, 3), 2);
  assert.equal(canvasRatio(390, 844, 1), 1);
  assert.equal(canvasRatio(1280, 720, 2), 2); // 3.7 million pixels: within the budget
  const big = canvasRatio(1920, 1080, 2);
  assert.ok(big > 1 && big < 2);
  assert.ok(1920 * 1080 * big * big <= 4_000_001);
  assert.equal(canvasRatio(3840, 2160, 2), 1); // never under 1
});
