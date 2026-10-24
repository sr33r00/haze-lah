import assert from "node:assert/strict";
import { test } from "node:test";
import { isNewer } from "@/lib/refresh";

test("isNewer refreshes only when NEA is ahead of the site", () => {
  assert.equal(isNewer("2026-10-25T01:00:00+08:00", "2026-10-25T00:00:00+08:00"), true);
  assert.equal(isNewer("2026-10-25T00:00:00+08:00", "2026-10-25T00:00:00+08:00"), false);
  assert.equal(isNewer("2026-10-24T23:00:00+08:00", "2026-10-25T00:00:00+08:00"), false);
});

test("isNewer refreshes when the site has no reading, never when NEA has none", () => {
  assert.equal(isNewer("2026-10-25T00:00:00+08:00", null), true);
  assert.equal(isNewer(null, "2026-10-25T00:00:00+08:00"), false);
  assert.equal(isNewer(null, null), false);
});
