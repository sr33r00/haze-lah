import assert from "node:assert/strict";
import { test } from "node:test";
import { CACHE_PREFIX, DEFAULT_LIMITS, DELETE_BATCH, KEEP_MS, cleanOldCacheVersions, type CacheBucket } from "@/lib/cacheVersions";

const NOW = Date.UTC(2026, 9, 28, 12);
const HOUR = 3_600_000;

/** An in-memory bucket with R2's listing rules: key order, `delimiter`, and pages of `pageSize` that continue with a cursor. */
function fakeBucket(objects: Record<string, number>, pageSize = 1000) {
  const store = new Map(Object.entries(objects));
  const calls = { list: 0, deletes: [] as number[] };
  const bucket: CacheBucket = {
    async list({ prefix, delimiter, cursor }) {
      calls.list++;
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (delimiter) {
        const prefixes = [...new Set(keys.map((k) => prefix + k.slice(prefix.length).split(delimiter)[0] + delimiter))];
        const from = cursor ? Number(cursor) : 0;
        const page = prefixes.slice(from, from + pageSize);
        return { objects: [], delimitedPrefixes: page, truncated: from + pageSize < prefixes.length, cursor: String(from + pageSize) };
      }
      const from = cursor ? Number(cursor) : 0;
      const page = keys.slice(from, from + pageSize);
      return { objects: page.map((key) => ({ key, uploaded: new Date(store.get(key)!) })), delimitedPrefixes: [], truncated: from + pageSize < keys.length, cursor: String(from + pageSize) };
    },
    async delete(keys) {
      calls.deletes.push(keys.length);
      for (const k of keys) store.delete(k);
    },
  };
  return { bucket, store, calls };
}

const key = (version: string, n: number) => `${CACHE_PREFIX}${version}/r2-v2/${String(n).padStart(5, "0")}/active`;

test("deletes a retired version, keeps the current one and one written within 48 hours", async () => {
  const { bucket, store } = fakeBucket({
    [key("cur", 1)]: NOW - HOUR,
    [key("old", 1)]: NOW - 100 * HOUR,
    [key("old", 2)]: NOW - 90 * HOUR,
    [key("recent", 1)]: NOW - 100 * HOUR,
    [key("recent", 2)]: NOW - 47 * HOUR,
    "other/file": NOW - 500 * HOUR,
  });
  const r = await cleanOldCacheVersions(bucket, "cur", NOW);
  assert.deepEqual({ versions: r.versions, removed: r.removed, kept: r.kept, skipped: r.skipped, deleted: r.deleted }, { versions: 3, removed: 1, kept: 1, skipped: 0, deleted: 2 });
  assert.deepEqual([...store.keys()].sort(), [key("cur", 1), key("recent", 1), key("recent", 2), "other/file"].sort());
});

test("keeps the current version even when all its objects are old", async () => {
  const { bucket, store } = fakeBucket({ [key("cur", 1)]: NOW - 500 * HOUR, [key("old", 1)]: NOW - 500 * HOUR });
  await cleanOldCacheVersions(bucket, "cur", NOW);
  assert.deepEqual([...store.keys()], [key("cur", 1)]);
});

test("the 48-hour line: an object exactly 48 hours old counts as old", async () => {
  const { bucket, store } = fakeBucket({ [key("cur", 1)]: NOW, [key("edge", 1)]: NOW - KEEP_MS, [key("fresh", 1)]: NOW - KEEP_MS + 1 });
  await cleanOldCacheVersions(bucket, "cur", NOW);
  assert.deepEqual([...store.keys()].sort(), [key("cur", 1), key("fresh", 1)]);
});

test("pages through long listings and deletes in batches of at most 1000", async () => {
  const objects: Record<string, number> = { [key("cur", 1)]: NOW };
  for (let i = 0; i < 2500; i++) objects[key("old", i)] = NOW - 200 * HOUR;
  const { bucket, store, calls } = fakeBucket(objects, 1000);
  const r = await cleanOldCacheVersions(bucket, "cur", NOW);
  assert.deepEqual(calls.deletes, [DELETE_BATCH, DELETE_BATCH, 500]);
  assert.equal(r.deleted, 2500);
  assert.equal(store.size, 1);
});

test("finds a recent object on a later page and then deletes nothing from that version", async () => {
  const objects: Record<string, number> = { [key("cur", 1)]: NOW };
  for (let i = 0; i < 2000; i++) objects[key("old", i)] = NOW - 200 * HOUR;
  objects[key("old", 1999)] = NOW - HOUR;
  const { bucket, store, calls } = fakeBucket(objects, 1000);
  const r = await cleanOldCacheVersions(bucket, "cur", NOW);
  assert.equal(r.kept, 1);
  assert.equal(calls.deletes.length, 0);
  assert.equal(store.size, 2001);
});

test("does nothing without a current version id, or when the current version has no entries", async () => {
  const { bucket, store, calls } = fakeBucket({ [key("old", 1)]: NOW - 500 * HOUR });
  assert.match((await cleanOldCacheVersions(bucket, undefined, NOW)).note ?? "", /no current version/);
  assert.match((await cleanOldCacheVersions(bucket, "cur", NOW)).note ?? "", /no entries/);
  assert.equal(calls.deletes.length, 0);
  assert.equal(store.size, 1);
});

test("stops at the call budget and a version with too many keys is skipped, not half judged", async () => {
  const objects: Record<string, number> = { [key("cur", 1)]: NOW };
  for (let i = 0; i < 30; i++) objects[key("big", i)] = NOW - 200 * HOUR;
  objects[key("small", 1)] = NOW - 200 * HOUR;
  const tooMany = fakeBucket(objects, 10);
  const r = await cleanOldCacheVersions(tooMany.bucket, "cur", NOW, { maxOps: 50, maxKeysPerVersion: 20 });
  assert.equal(r.skipped, 1);
  assert.equal(r.removed, 1);
  assert.equal(tooMany.store.size, 31);

  const noBudget = fakeBucket(objects, 1000);
  const b = await cleanOldCacheVersions(noBudget.bucket, "cur", NOW, { maxOps: 2, maxKeysPerVersion: DEFAULT_LIMITS.maxKeysPerVersion });
  assert.ok(b.ops >= 2 && noBudget.calls.deletes.length === 0);
  assert.equal(noBudget.store.size, 32);
});
