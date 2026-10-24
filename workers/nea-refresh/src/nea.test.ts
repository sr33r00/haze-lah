import assert from "node:assert/strict";
import { test } from "node:test";
import { sgtDate, signature, type NeaItem } from "./nea.ts";

const item = (timestamp: string, v: Record<string, number>): NeaItem => ({ timestamp, readings: { pm25_one_hourly: v } });
const v = { north: 63, south: 62, east: 63, west: 92, central: 76 };

test("sgtDate rolls over at 16:00 UTC", () => {
  assert.equal(sgtDate(new Date("2026-10-24T15:59:59Z")), "2026-10-24");
  assert.equal(sgtDate(new Date("2026-10-24T16:00:00Z")), "2026-10-25");
});

test("signature is null without items", () => {
  assert.equal(signature([]), null);
});

test("signature uses the newest item and a fixed region order", () => {
  const items = [item("2026-10-25T00:00:00+08:00", v), item("2026-10-24T23:00:00+08:00", { north: 1, south: 1, east: 1, west: 1, central: 1 })];
  assert.equal(signature(items), "2026-10-25T00:00:00+08:00 63,62,63,92,76");
  assert.equal(signature([...items].reverse()), signature(items));
});

test("signature ignores updatedTimestamp but notices a revised value", () => {
  const a = signature([{ ...item("2026-10-25T00:00:00+08:00", v), updatedTimestamp: "x" } as NeaItem]);
  const b = signature([{ ...item("2026-10-25T00:00:00+08:00", v), updatedTimestamp: "y" } as NeaItem]);
  assert.equal(a, b);
  assert.notEqual(a, signature([item("2026-10-25T00:00:00+08:00", { ...v, west: 90 })]));
});
