"use client";

import { useEffect, useState } from "react";

/**
 * The current time in ms, for rendering time-dependent views. The server and the first client render use `initial`
 * (the data's build time), so they agree and hydration does not keep a stale hour; after mount it switches to the real
 * clock and ticks every minute while the tab is visible.
 */
export function useNow(initial: string): number {
  const [now, setNow] = useState(() => Date.parse(initial));
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
