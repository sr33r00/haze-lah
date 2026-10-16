"use client";

import { BookOpen, CalendarDays, CircleGauge, Map, Newspaper } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Tab order, also used for swipe navigation. */
export const ITEMS = [
  { href: "/", label: "Now", icon: CircleGauge },
  { href: "/forecast", label: "Forecast", icon: CalendarDays },
  { href: "/map", label: "Map", icon: Map },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

/** Thumb-reach tabs for phones; News shows a dot when something is newer than the last visit. */
export default function BottomNav({ newest }: { newest: number | null }) {
  const path = usePathname();
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    try {
      if (path === "/news") {
        localStorage.setItem("newsSeen", String(Date.now()));
        setFresh(false);
      } else setFresh(newest != null && newest > Number(localStorage.getItem("newsSeen") ?? 0));
    } catch {}
  }, [path, newest]);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = href === path;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${on ? "text-fg" : "text-muted"}`}
              >
                <span className="relative">
                  <Icon size={20} aria-hidden />
                  {href === "/news" && fresh && (
                    <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-[var(--lv3)]">
                      <span className="sr-only">New updates</span>
                    </span>
                  )}
                </span>
                {label}
                <span aria-hidden className={`h-0.5 w-5 rounded-full ${on ? "bg-fg" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
