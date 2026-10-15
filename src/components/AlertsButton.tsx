"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "bell-rung";

/** Header pill linking to Telegram alerts; the bell rings once per session to draw the eye. */
export default function AlertsButton({ href }: { href: string }) {
  const [ring, setRing] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setRing(true);
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Get haze alerts on Telegram"
      className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full bg-accent px-2.5 text-[13px] font-semibold text-bg min-[400px]:px-3"
    >
      <Bell size={16} aria-hidden className={ring ? "origin-top animate-ring" : ""} />
      {/* Icon only on narrow phones so the title bar fits. */}
      <span className="hidden min-[400px]:inline">Alerts</span>
    </a>
  );
}
