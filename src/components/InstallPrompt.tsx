"use client";

import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __installEvent?: InstallEvent;
  }
}

const DISMISSED = "install-dismissed";
const VISITS = "visits";
const QUIET_DAYS = 30;

/**
 * "Add to home screen", from the second visit on, until dismissed (then quiet for a month). Browsers that support
 * installing get a button; iPhone and iPad get the two steps, since Safari has no install button for sites.
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<"install" | "ios" | null>(null);

  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    let visits = 0;
    try {
      if (Date.now() - Number(localStorage.getItem(DISMISSED) ?? 0) < QUIET_DAYS * 86400_000) return;
      visits = Number(localStorage.getItem(VISITS) ?? 0);
      if (!sessionStorage.getItem(VISITS)) {
        visits++;
        localStorage.setItem(VISITS, String(visits));
        sessionStorage.setItem(VISITS, "1");
      }
    } catch {}
    if (visits < 2) return;

    const ready = () => window.__installEvent && setMode("install");
    const installed = () => setMode(null);
    ready();
    if (!window.__installEvent && /iphone|ipad|ipod/i.test(navigator.userAgent)) setMode("ios");
    addEventListener("installready", ready);
    addEventListener("appinstalled", installed);
    return () => {
      removeEventListener("installready", ready);
      removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!mode) return null;
  const close = () => {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {}
  };
  const install = async () => {
    const e = window.__installEvent;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__installEvent = undefined;
    if (outcome === "accepted") setMode(null);
    else close();
  };

  return (
    <div
      role="dialog"
      aria-label="Add Haze Lah to your home screen"
      className="fixed inset-x-3 bottom-[calc(var(--nav-space)+0.5rem)] z-[999] mx-auto flex max-w-md animate-rise items-center gap-3 rounded-3xl bg-fg p-3 pl-4 text-bg shadow-xl ring-1 ring-black/10 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[380px]"
    >
      <Smartphone size={22} aria-hidden className="shrink-0" />
      <div className="min-w-0 flex-1 text-label leading-snug">
        <p className="font-bold">Add Haze Lah to your home screen</p>
        {mode === "install" ? (
          <p className="opacity-75">Today&apos;s haze, one tap away.</p>
        ) : (
          <p className="opacity-75">
            Tap <Share size={14} aria-label="Share" className="inline align-[-2px]" /> then &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
      </div>
      {mode === "install" && (
        <button onClick={install} className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-label font-semibold text-bg ring-2 ring-bg/30 hover:opacity-90">
          Install
        </button>
      )}
      <button onClick={close} aria-label="Dismiss" className="flex size-11 shrink-0 items-center justify-center rounded-full opacity-75 hover:bg-bg/15 hover:opacity-100">
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
