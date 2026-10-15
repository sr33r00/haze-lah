"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ago } from "@/lib/format";

const EVERY = 5 * 60_000;

/** "Updated 3 min ago"; re-fetches the page data every 5 minutes while visible, and on return if stale. */
export default function Freshness({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [, tick] = useState(0);

  useEffect(() => {
    let last = Date.now();
    // Redraw the label every minute; fetch fresh data at most every 5 minutes, and only while visible.
    const check = () => {
      tick((n) => n + 1);
      const visible = document.visibilityState === "visible";
      if (visible && Date.now() - Date.parse(generatedAt) > EVERY && Date.now() - last > EVERY) {
        last = Date.now();
        router.refresh();
      }
    };
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [generatedAt, router]);

  return <span suppressHydrationWarning>updated {ago(generatedAt)}</span>;
}
