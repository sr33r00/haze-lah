"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ago } from "@/lib/format";

// The pages are rebuilt on demand when NEA publishes (about 15 minutes past the hour), so any open page can be outdated within minutes.
const STALE = 10 * 60_000;

/** "Updated 3 min ago"; re-fetches the page data (at most every 10 minutes) while visible when it is older than that, and on return to the tab. */
export default function Freshness({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [, tick] = useState(0);

  useEffect(() => {
    let last = Date.now();
    // Redraw the label every minute; refresh at most every 10 minutes, only while visible. This reads the edge-cached page, which costs no function time.
    const check = () => {
      tick((n) => n + 1);
      const visible = document.visibilityState === "visible";
      if (visible && Date.now() - Date.parse(generatedAt) > STALE && Date.now() - last > STALE) {
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
