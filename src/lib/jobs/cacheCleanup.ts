import { env } from "cloudflare:workers";
import { cleanOldCacheVersions, type CleanupResult } from "../cacheVersions";

/**
 * Daily: deletes the shared page cache's retired versions (`runtime-cache/<version-id>/` in the bucket `CACHE_BODIES`), i.e. every
 * version except the current one whose newest object is over 48 hours old. See `src/lib/cacheVersions.ts`. Skips quietly without the bucket.
 * The store's Durable Object metadata for old versions is left alone: the store offers no way to clear it (see its README), and it only indexes tags and freshness.
 */
export async function cleanCacheVersions(): Promise<CleanupResult | { note: string }> {
  if (!env.CACHE_BODIES || !env.CF_VERSION_METADATA) return { note: "cache bucket or version binding not bound, skipped" };
  const result = await cleanOldCacheVersions(env.CACHE_BODIES, env.CF_VERSION_METADATA.id);
  console.log(JSON.stringify({ event: "cache-cleanup", ...result }));
  return result;
}
