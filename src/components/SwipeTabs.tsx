"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ITEMS } from "./BottomNav";

const MIN_DX = 70;
const MAX_MS = 600;

/** True where a swipe belongs to the element: maps, sliders, inputs, opted-out areas, horizontal scrollers. */
function blocksSwipe(target: EventTarget | null) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches(".leaflet-container, input, textarea, select, [data-no-swipe]")) return true;
    if (el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

/** Swipe left or right to move between tabs on touch screens. Renders nothing. */
export default function SwipeTabs() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && !blocksSwipe(e.target) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    };
    const up = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) <= MIN_DX || Math.abs(dx) <= 2 * Math.abs(dy) || Date.now() - s.t >= MAX_MS) return;
      const at = ITEMS.findIndex((i) => i.href === path);
      const to = at < 0 ? undefined : ITEMS[at + (dx < 0 ? 1 : -1)];
      if (to) router.push(to.href);
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchend", up);
    };
  }, [path, router]);

  return null;
}
