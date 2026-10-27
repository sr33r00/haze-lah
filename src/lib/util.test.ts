import assert from "node:assert/strict";
import { test } from "node:test";
import { isFresh } from "@/lib/util";

test("something built within its maximum age is fresh, and older is not", () => {
  assert.equal(isFresh(1000, 500, 1000), true);
  assert.equal(isFresh(1000, 500, 1500), true);
  assert.equal(isFresh(1000, 500, 1501), false);
});
