// Cleanup of the shared page cache (Workers Response Store, self-contained). Pure: it works on any bucket shaped like R2, so it is tested without a Worker.
//
// The store keeps each deployed Worker version's entries under `runtime-cache/<version-id>/` in the bucket and never deletes them.
// Its docs advise deleting a retired version's prefix, not an age-only lifecycle rule. We treat a version as retired when it is not the
// current one and nothing was written under it for 48 hours, so a rollback within two days still finds a warm cache.

/** Where the store keeps every version's entries. */
export const CACHE_PREFIX = "runtime-cache/";

/** How long a version that is no longer current is kept after its newest write. */
export const KEEP_MS = 48 * 3_600_000;

/** R2 deletes at most this many keys in one call. */
export const DELETE_BATCH = 1000;

/** The part of an R2 bucket the cleanup uses. */
export type CacheBucket = {
  list(options: { prefix: string; delimiter?: string; cursor?: string }): Promise<{
    objects: { key: string; uploaded: Date }[];
    delimitedPrefixes: string[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string[]): Promise<void>;
};

/** What the cleanup may spend in one run: bucket calls (a list page or a delete batch each) and keys held in memory for one version. */
export type CleanupLimits = { maxOps: number; maxKeysPerVersion: number };

/** About 150 calls is at most 150 000 keys listed or deleted, and far inside a Worker's request limits. */
export const DEFAULT_LIMITS: CleanupLimits = { maxOps: 150, maxKeysPerVersion: 50_000 };

/** What one cleanup run did: `deleted` objects across `removed` versions, `kept` versions still recent, `skipped` ones too big or out of budget (the next run continues). */
export type CleanupResult = { versions: number; removed: number; kept: number; skipped: number; deleted: number; ops: number; note?: string };

/**
 * Deletes every cached version that is not `currentVersion` and whose newest object is older than `KEEP_MS`.
 * Never deletes anything without `currentVersion`, or when the current version has no entries (then the id may not be the one the store uses).
 * A version is deleted only after all its objects were listed and found old; the work stops at `limits`, and the next run carries on.
 */
export async function cleanOldCacheVersions(bucket: CacheBucket, currentVersion: string | undefined, now = Date.now(), limits = DEFAULT_LIMITS): Promise<CleanupResult> {
  const result: CleanupResult = { versions: 0, removed: 0, kept: 0, skipped: 0, deleted: 0, ops: 0 };
  if (!currentVersion) return { ...result, note: "no current version id, skipped" };
  const spend = () => result.ops++ < limits.maxOps;

  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    if (!spend()) return { ...result, note: "out of budget while listing versions" };
    const page = await bucket.list({ prefix: CACHE_PREFIX, delimiter: "/", cursor });
    ids.push(...page.delimitedPrefixes.map((p) => p.slice(CACHE_PREFIX.length, -1)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  result.versions = ids.length;
  if (!ids.includes(currentVersion)) return { ...result, note: "current version has no entries, skipped" };

  const cutoff = now - KEEP_MS;
  for (const id of ids) {
    if (id === currentVersion) continue;
    const prefix = `${CACHE_PREFIX}${id}/`;
    const keys: string[] = [];
    let recent = false;
    let complete = true;
    let next: string | undefined;
    do {
      if (!spend()) {
        complete = false;
        break;
      }
      const page = await bucket.list({ prefix, cursor: next });
      if (page.objects.some((o) => o.uploaded.getTime() > cutoff)) {
        recent = true;
        break;
      }
      keys.push(...page.objects.map((o) => o.key));
      next = page.truncated ? page.cursor : undefined;
      if (next && keys.length >= limits.maxKeysPerVersion) complete = false;
    } while (next && complete);
    if (recent) {
      result.kept++;
      continue;
    }
    if (!complete) {
      result.skipped++;
      continue;
    }
    let version = 0;
    for (let i = 0; i < keys.length && spend(); i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      await bucket.delete(batch);
      version += batch.length;
    }
    result.deleted += version;
    if (version === keys.length) result.removed++;
    else result.skipped++;
  }
  return result;
}
