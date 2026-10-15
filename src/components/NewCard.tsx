"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ALERTS_URL } from "@/lib/links";

const KEY = "seen-new";
const VERSION = "2026-10";
const chip = "rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-semibold";

/** Dismissible pointer to recent features; hidden until storage has been read. */
export default function NewCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== VERSION) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {}
  };

  return (
    <div className="relative mx-4 mt-4 rounded-3xl bg-surface p-4">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-muted">
        <X size={18} aria-hidden />
      </button>
      <p className="text-[15px] font-bold">New in Haze Lah</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALERTS_URL && (
          <a className={chip} href={ALERTS_URL} target="_blank" rel="noreferrer">
            Telegram alerts
          </a>
        )}
        <Link className={chip} href="/glance">
          Big screen view
        </Link>
        <a className={chip} href="#what-to-do">
          Mask guide
        </a>
        <Link className={chip} href="/map">
          Community sensors
        </Link>
      </div>
      <p className="mt-3 text-[13px] text-muted">Tip: swipe left or right to switch tabs.</p>
    </div>
  );
}
