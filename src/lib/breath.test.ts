import assert from "node:assert/strict";
import { test } from "node:test";
import { timesNormal } from "@/lib/breath";

test("timesNormal compares PM2.5 with a normal day of 12 µg/m³", () => {
  assert.deepEqual(timesNormal(22), { big: "1.8×", label: "a normal day's PM2.5" });
  assert.equal(timesNormal(12)?.label, "About a normal day");
  assert.equal(timesNormal(6)?.label, "Cleaner than a normal day");
  assert.equal(timesNormal(NaN), null);
});
