"use client";

import { useEffect, useState } from "react";
import type { OutdoorFeeds } from "@/lib/types";

/** How often the feeds are read again while the tab is visible (ms): the server keeps its copy for 5 minutes. */
const REFRESH_MS = 300_000;

/** The last good answer and when it was read, kept for the life of the page so going back to Now shows it at once. */
let cached: { feeds: OutdoorFeeds; at: number } | undefined;
/** The request in flight, shared by every mount so two components never fire two. */
let inflight: Promise<OutdoorFeeds | null> | undefined;

/** Reads the feeds once at a time; resolves null on failure and keeps the older answer. */
function load(): Promise<OutdoorFeeds | null> {
  inflight ??= fetch("/api/outdoor")
    .then((r) => (r.ok ? (r.json() as Promise<OutdoorFeeds>) : Promise.reject(new Error(String(r.status)))))
    .then((feeds) => {
      cached = { feeds, at: Date.now() };
      return feeds;
    })
    .catch(() => null)
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** NEA's rain, heat, UV and lightning feeds from `/api/outdoor`: undefined until the first answer, null if it failed (an older answer is kept when a refresh fails). */
export function useOutdoor(): OutdoorFeeds | null | undefined {
  // The server never has a cached answer and a hard load starts empty on both sides, so this cannot mismatch; a client-side
  // navigation back to Now has no hydration and starts from the last answer instead of a skeleton.
  const [feeds, setFeeds] = useState<OutdoorFeeds | null | undefined>(() => cached?.feeds);
  useEffect(() => {
    const refresh = () => load().then((f) => setFeeds((old) => f ?? old ?? null));
    const stale = () => !cached || Date.now() - cached.at >= REFRESH_MS - 1000;
    const tick = () => document.visibilityState === "visible" && stale() && refresh();
    if (stale()) refresh();
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return feeds;
}
