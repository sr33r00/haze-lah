import type { HistoryDay, HistoryIndex } from "@/lib/history";

/** The daily history files the globe's timeline plays, served from the repo by jsDelivr (no per-visitor server route). */
export const HISTORY_BASE = "https://cdn.jsdelivr.net/gh/sr33r00/haze-lah@main/data/history/";

/** The URL of a day's file (`YYYY-MM-DD`) or of the index (`index`). */
export const historyUrl = (name: string) => `${HISTORY_BASE}${name}.json`;

/** The JSON at `url`, or null on a network error, a non-2xx status or a body that is not JSON. Never throws. */
async function getJson(url: string, fetchFn: typeof fetch, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetchFn(url, init);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The index of days, or null on any failure. It changes daily, so a stale browser copy is revalidated. */
export async function loadIndex(fetchFn: typeof fetch = fetch): Promise<HistoryIndex | null> {
  const json = (await getJson(historyUrl("index"), fetchFn, { cache: "no-cache" })) as HistoryIndex | null;
  return json && Array.isArray(json.days) ? json : null;
}

/** One request per date for the session; a missing or invalid day (null) is remembered too. */
const days = new Map<string, Promise<HistoryDay | null>>();

/** A day's file, or null when it is missing or not that day's. Memoised; day files never change, so the default cache applies. */
export function loadDay(date: string, fetchFn: typeof fetch = fetch): Promise<HistoryDay | null> {
  let p = days.get(date);
  if (!p) {
    p = getJson(historyUrl(date), fetchFn).then((json) => {
      const day = json as HistoryDay | null;
      return day && day.date === date ? day : null;
    });
    days.set(date, p);
  }
  return p;
}

/** Starts loading the two dates after `date` in `dates` (oldest first) so playback does not wait. Fire and forget; never throws. */
export function prefetchAround(date: string, dates: string[], fetchFn: typeof fetch = fetch): void {
  const i = dates.indexOf(date);
  if (i < 0) return;
  for (const next of dates.slice(i + 1, i + 3)) loadDay(next, fetchFn).catch(() => {});
}
