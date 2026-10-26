"use client";

import { useEffect, useState } from "react";
import type { OutdoorFeeds } from "@/lib/types";

/** How often the feeds are read again while the tab is visible (ms): the server keeps its copy for 5 minutes. */
const REFRESH_MS = 300_000;

/** NEA's rain, heat, UV and lightning feeds from `/api/outdoor`: undefined until the first answer, null if it failed (an older answer is kept when a refresh fails). */
export function useOutdoor(): OutdoorFeeds | null | undefined {
  const [feeds, setFeeds] = useState<OutdoorFeeds | null | undefined>(undefined);
  useEffect(() => {
    let last = 0;
    const load = () => {
      last = Date.now();
      fetch("/api/outdoor")
        .then((r) => (r.ok ? (r.json() as Promise<OutdoorFeeds>) : Promise.reject(new Error(String(r.status)))))
        .then(setFeeds)
        .catch(() => setFeeds((old) => old ?? null));
    };
    const tick = () => document.visibilityState === "visible" && Date.now() - last >= REFRESH_MS - 1000 && load();
    load();
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return feeds;
}
