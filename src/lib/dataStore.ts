import { env } from "cloudflare:workers";
import { isFresh } from "./util";

// The site's private data in the R2 bucket `DATA` (wrangler.jsonc). Server only, and the one place that touches the bucket.
// Keys are paths without a leading slash: `history/index.json`, `archive/2026-10.jsonl`, `accuracy.json`.

/** Whether the bucket is bound (it is not in some local runs). */
export const hasStore = () => Boolean(env.DATA);

/** The text at `key`; null when there is none. Throws when the bucket cannot be read. */
export async function readText(key: string): Promise<string | null> {
  const obj = await env.DATA.get(key);
  return obj ? obj.text() : null;
}

/** The text at `key` if it was stored within `maxAgeMs`; null when there is none, it is older, the bucket is unbound or on any error (the caller builds the data instead). */
export async function readTextFresh(key: string, maxAgeMs: number): Promise<string | null> {
  try {
    if (!hasStore()) return null;
    const obj = await env.DATA.get(key);
    return obj && isFresh(obj.uploaded.getTime(), maxAgeMs) ? await obj.text() : null;
  } catch {
    return null;
  }
}

/** Whether `key` was stored within `maxAgeMs`; false when there is none, it is older, the bucket is unbound or on any error (the caller builds it). Reads no body. */
export async function isStoredFresh(key: string, maxAgeMs: number): Promise<boolean> {
  try {
    if (!hasStore()) return false;
    const obj = await env.DATA.head(key);
    return obj !== null && isFresh(obj.uploaded.getTime(), maxAgeMs);
  } catch {
    return false;
  }
}

/** The JSON at `key`; null when there is none. Throws when the bucket cannot be read or the text is not JSON (what a job needs, so it never overwrites a file it failed to read). */
export async function readJsonStrict<T>(key: string): Promise<T | null> {
  const text = await readText(key);
  return text === null ? null : (JSON.parse(text) as T);
}

/** The JSON at `key`; null when there is none or on any error (what a page needs: it shows less rather than failing). */
export async function readJson<T>(key: string): Promise<T | null> {
  return readJsonStrict<T>(key).catch(() => null);
}

/** Stores `text` at `key`, replacing what is there. */
export async function writeText(key: string, text: string, contentType = "text/plain; charset=utf-8"): Promise<void> {
  await env.DATA.put(key, text, { httpMetadata: { contentType } });
}

/** Stores `value` as JSON at `key`, replacing what is there. */
export const writeJson = (key: string, value: unknown) => writeText(key, JSON.stringify(value), "application/json");

/** Every key that starts with `prefix`, in key order. */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.DATA.list({ prefix, cursor });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

/** Deletes `key`; nothing happens when there is none. */
export const removeKey = (key: string) => env.DATA.delete(key);
