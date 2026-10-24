"use client";

import { useEffect, useSyncExternalStore } from "react";
import { inSingapore } from "@/lib/util";

export type MyPosition = { lat: number; lon: number };
/** How a locate attempt ended: "outside" means found, but not in Singapore. */
export type LocateResult = ({ status: "ok" } & MyPosition) | { status: "outside" | "failed" | "unsupported" };

// One position for the whole page, so a spot found by the Hero's locate button also shows on the map.
let current: MyPosition | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Ask the browser where the visitor is (this prompts for permission unless already decided). A position in Singapore is kept for `useMyPosition`. */
export function locateMe(): Promise<LocateResult> {
  if (!navigator.geolocation) return Promise.resolve({ status: "unsupported" });
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        if (!inSingapore(c.latitude, c.longitude)) return resolve({ status: "outside" });
        current = { lat: c.latitude, lon: c.longitude };
        listeners.forEach((l) => l());
        resolve({ status: "ok", ...current });
      },
      () => resolve({ status: "failed" }),
      { timeout: 8000, maximumAge: 600_000 },
    ),
  );
}

/** The visitor's position once known (null until then). With `auto`, it is looked up silently on mount, only if location permission was already granted: it never prompts. */
export function useMyPosition(auto = false) {
  const position = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (!auto || current) return;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") void locateMe();
      })
      .catch(() => {});
  }, [auto]);
  return position;
}
