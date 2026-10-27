import { readTextFresh, writeText } from "./dataStore";

// Data that is costly to build is built once an hour by a job step (`storeBuilt`) and read from the bucket by the pages and API routes
// (`storedText`, `storedJson`), so that every Cloudflare data centre does not rebuild it. The bucket's own upload time says when it was built.

/** The JSON text stored at `key` if it was built within `maxAgeMs`; otherwise `build()` as JSON (nothing is stored, and demo mode never reads the bucket). */
export async function storedText(key: string, maxAgeMs: number, build: () => Promise<unknown>): Promise<string> {
  const stored = process.env.HAZE_MOCK === "1" ? null : await readTextFresh(key, maxAgeMs);
  return stored ?? JSON.stringify(await build());
}

/** `storedText`, parsed. */
export async function storedJson<T>(key: string, maxAgeMs: number, build: () => Promise<T>): Promise<T> {
  return JSON.parse(await storedText(key, maxAgeMs, build)) as T;
}

/** The job step: builds the data and stores it at `key`. A build that throws leaves the old copy in place. */
export async function storeBuilt(key: string, build: () => Promise<unknown>): Promise<{ bytes: number }> {
  const text = JSON.stringify(await build());
  await writeText(key, text, "application/json");
  return { bytes: text.length };
}
