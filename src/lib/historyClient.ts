import type { HistoryDay, HistoryIndex } from "@/lib/historyTypes";

/** The daily history files the globe's timeline plays and their index, served by this site from its private data bucket (`/data/history/`). */
export const HISTORY_BASE = "/data/history/";

/** The URL of a day's file (`YYYY-MM-DD`), or of the index (`index`). */
export const historyUrl = (name: string) => `${HISTORY_BASE}${name}.json`;

/** The index of days: it changes daily, so the server lets a browser keep it for 5 minutes only. */
export const INDEX_URL = historyUrl("index");

/** What `getJson` answers for a 404: the file is not there, and asking again will not change that. */
const MISSING = Symbol("missing");

/** The JSON at `url`; MISSING on a 404; null on a network error, any other non-2xx status (5xx, 429) or a body that is not JSON. Never throws. */
async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
  try {
    const res = await fetchFn(url);
    if (res.status === 404) return MISSING;
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const asIndex = (json: unknown) => (json && json !== MISSING && Array.isArray((json as HistoryIndex).days) ? (json as HistoryIndex) : null);

/** The index of days, or null on any failure. */
export async function loadIndex(fetchFn: typeof fetch = fetch): Promise<HistoryIndex | null> {
  return asIndex(await getJson(INDEX_URL, fetchFn));
}

/** One request per date for the session; a day that loaded, or that is definitely not there (a 404: a gap day), is remembered. */
const days = new Map<string, Promise<HistoryDay | null>>();

/**
 * A day's file, or null when it is missing or not that day's. Memoised once loaded, and as null on a 404 (the timeline passes over a
 * gap day many times); a network error, a 5xx or 429, or a body that is not that day's is not, so the next call tries again.
 * Day files never change, so the default cache applies.
 */
export function loadDay(date: string, fetchFn: typeof fetch = fetch): Promise<HistoryDay | null> {
  let p = days.get(date);
  if (!p) {
    p = getJson(historyUrl(date), fetchFn).then((json) => {
      if (json === MISSING) return null; // definitive: stays remembered
      const day = json as HistoryDay | null;
      if (day && day.date === date) return day;
      days.delete(date); // a transient failure or a wrong body is not remembered: a later call tries again
      return null;
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
