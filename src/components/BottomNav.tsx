"use client";

import { BookOpen, CalendarDays, Camera, CircleGauge, Map, Newspaper } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Tab order. Every tab link sets `prefetch`: the whole page is fetched ahead, so a tap renders from the router cache with no skeleton (the default prefetch of a route with a loading.tsx fetches only the skeleton). */
const ITEMS = [
  { href: "/", label: "Now", icon: CircleGauge },
  { href: "/forecast", label: "Forecast", icon: CalendarDays },
  { href: "/map", label: "Map", icon: Map },
  { href: "/photos", label: "Photos", icon: Camera },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

/** True on News-tab links when something is newer than the last visit; visiting News clears it. */
function useFresh(newest: number | null, path: string) {
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    try {
      if (path === "/news") {
        localStorage.setItem("newsSeen", String(Date.now()));
        setFresh(false);
      } else setFresh(newest != null && newest > Number(localStorage.getItem("newsSeen") ?? 0));
    } catch {}
  }, [path, newest]);
  return fresh;
}

function NewDot({ className }: { className: string }) {
  return (
    <span className={`absolute h-2.5 w-2.5 rounded-full border-2 border-surface bg-fg ${className}`}>
      <span className="sr-only">New updates</span>
    </span>
  );
}

/** Same tabs inline in the header for laptops and bigger; the active tab gets an underline. */
export function TopNav({ newest }: { newest: number | null }) {
  const path = usePathname();
  const fresh = useFresh(newest, path);
  return (
    <nav aria-label="Sections" className="hidden min-w-0 flex-1 justify-center lg:flex">
      <ul className="flex gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = href === path;
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch
                aria-current={on ? "page" : undefined}
                className={`relative flex h-14 items-center gap-1.5 px-3 text-label font-semibold hover:text-fg xl:px-4 ${on ? "text-fg" : "text-muted"}`}
              >
                <span className="relative hidden xl:block">
                  <Icon size={18} aria-hidden />
                  {href === "/news" && fresh && <NewDot className="-right-1 -top-0.5" />}
                </span>
                {label}
                {href === "/news" && fresh && <NewDot className="right-1 top-4 xl:hidden" />}
                <span aria-hidden className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full xl:inset-x-4 ${on ? "bg-fg" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Thumb-reach tabs for phones (64 px tall, the active one in a pill; the height and bottom padding are `--nav-h` and `--nav-pad` in globals.css); News shows a dot when something is newer than the last visit. */
export default function BottomNav({ newest }: { newest: number | null }) {
  const path = usePathname();
  const fresh = useFresh(newest, path);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 pb-[var(--nav-pad)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = href === path;
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch
                aria-current={on ? "page" : undefined}
                className={`group flex min-h-[var(--nav-h)] w-full flex-col items-center justify-center gap-0.5 whitespace-nowrap text-fine font-semibold ${on ? "text-fg" : "text-muted"}`}
              >
                <span
                  className={`relative flex h-[30px] w-14 max-w-full items-center justify-center rounded-full transition-colors duration-100 motion-reduce:transition-none ${on ? "bg-line group-active:bg-muted/40" : "bg-transparent group-active:bg-line"}`}
                >
                  <Icon size={24} aria-hidden />
                  {href === "/news" && fresh && <NewDot className="right-3.5 top-0.5" />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
