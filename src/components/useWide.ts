"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `lg`: from here up the Now page has two columns and a map panel. */
export const LG = "(min-width: 1024px)";

/** Whether the window is at least `lg` wide; null on the server and while hydrating, until the client knows. */
export function useWide(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    (notify) => {
      const q = matchMedia(LG);
      q.addEventListener("change", notify);
      return () => q.removeEventListener("change", notify);
    },
    () => matchMedia(LG).matches,
    () => null,
  );
}
