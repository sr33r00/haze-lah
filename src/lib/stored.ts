import { isStoredFresh, readTextFresh, writeText } from "./dataStore";

// Data that is costly to build is built by a job step (`storeBuilt`) and read from the bucket by the pages and API routes
// (`storedText`, `storedJson`), so that every Cloudflare data centre does not rebuild it. The bucket's own upload time says when it was built.
// Copies that come from Open-Meteo (a daily call limit) are rebuilt at most every few hours, and readers keep serving the last good copy
// for `LAST_GOOD_MS` when a rebuild fails, rather than every data centre calling Open-Meteo again.

/** How old a copy built from Open-Meteo may be when it is served: a day, so a failed rebuild keeps serving the last good copy. */
export const LAST_GOOD_MS = 24 * 3600_000;

/** The JSON text stored at `key` if it was built within `maxAgeMs`; otherwise `build()` as JSON (nothing is stored, and demo mode never reads the bucket). */
export async function storedText(key: string, maxAgeMs: number, build: () => Promise<unknown>): Promise<string> {
  const stored = process.env.HAZE_MOCK === "1" ? null : await readTextFresh(key, maxAgeMs);
  return stored ?? JSON.stringify(await build());
}

/** `storedText`, parsed. */
export async function storedJson<T>(key: string, maxAgeMs: number, build: () => Promise<T>): Promise<T> {
  return JSON.parse(await storedText(key, maxAgeMs, build)) as T;
}

/**
 * The job step: builds the data and stores it at `key`. A build that throws leaves the old copy in place.
 * With `minAgeMs`, a copy stored less than that long ago is left alone and nothing is built (`{ skipped: true }`).
 */
export async function storeBuilt(key: string, build: () => Promise<unknown>, minAgeMs = 0): Promise<{ bytes: number } | { skipped: true }> {
  if (minAgeMs > 0 && (await isStoredFresh(key, minAgeMs))) return { skipped: true };
  const text = JSON.stringify(await build());
  await writeText(key, text, "application/json");
  return { bytes: text.length };
}
