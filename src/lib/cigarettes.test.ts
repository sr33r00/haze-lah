import assert from "node:assert/strict";
import { test } from "node:test";
import { cigarettes, cigarettesSoFar, exactSoFar, packIcons } from "@/lib/cigarettes";
import type { HourPoint } from "@/lib/types";

const MIDNIGHT = Date.parse("2026-10-23T16:00:00Z"); // 00:00 SGT, Sat 24 Oct

/** One reading per hour from midnight SGT, `values[i]` at hour i. */
const day = (values: number[]): HourPoint[] => values.map((value, i) => ({ time: new Date(MIDNIGHT + i * 3600_000).toISOString(), value }));

test("cigarettes rounds to a tenth below one, else to a whole number", () => {
  assert.equal(cigarettes(22), 1);
  assert.equal(cigarettes(63), 3);
  assert.equal(cigarettes(11), 0.5);
});

test("cigarettes is null when unusable and never negative", () => {
  assert.equal(cigarettes(NaN), null);
  assert.equal(cigarettes(-5), 0);
});

test("cigarettes so far sums the hours since midnight over 24 hours", () => {
  const now = new Date(MIDNIGHT + 12.5 * 3600_000); // 12:30 SGT
  const points = day(Array(12).fill(44)); // 12 hours at 44 µg/m³
  assert.equal(exactSoFar(points, now), 1); // 12 * 44 / 24 / 22
  assert.equal(cigarettesSoFar(points, now), 1);
});

test("cigarettes so far is null before 1am or with no readings", () => {
  const early = new Date(MIDNIGHT + 0.5 * 3600_000);
  assert.equal(exactSoFar(day([30]), early), null);
  assert.equal(cigarettesSoFar(day([30]), early), null);
  assert.equal(exactSoFar([], new Date(MIDNIGHT + 5 * 3600_000)), null);
});

test("packIcons burns whole cigarettes to stubs and lights the current one", () => {
  const { per, icons } = packIcons(4.6);
  assert.equal(per, 1);
  assert.equal(icons.length, 5);
  assert.ok(icons.slice(0, 4).every((c) => c.burnt === 1 && !c.lit));
  assert.ok(Math.abs(icons[4].burnt - 0.6) < 1e-9 && icons[4].lit);
});

test("packIcons shows less than one cigarette as one lit, partly burnt icon", () => {
  const { icons } = packIcons(0.4);
  assert.equal(icons.length, 1);
  assert.deepEqual(icons[0], { burnt: 0.4, lit: true });
});

test("packIcons lights a fresh cigarette after an exact whole number", () => {
  const { icons } = packIcons(2);
  assert.deepEqual(icons, [{ burnt: 1, lit: false }, { burnt: 1, lit: false }, { burnt: 0, lit: true }]);
});

test("packIcons scales past ten icons and keeps the lit one unfinished", () => {
  const { per, icons } = packIcons(23);
  assert.equal(per, 2.3);
  assert.equal(icons.length, 10);
  assert.ok(icons.slice(0, 9).every((c) => c.burnt === 1 && !c.lit));
  assert.ok(icons[9].lit && icons[9].burnt < 1);
});
