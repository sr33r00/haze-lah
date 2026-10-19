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
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[999] mx-auto flex max-w-md animate-rise items-center gap-3 rounded-3xl border border-line bg-surface p-3 pl-4 shadow-lg lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[380px]"
    >
      <Smartphone size={22} aria-hidden className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-[14px] leading-snug">
        <p className="font-bold">Add Haze Lah to your home screen</p>
        {mode === "install" ? (
          <p className="text-muted">Today&apos;s haze, one tap away.</p>
        ) : (
          <p className="text-muted">
            Tap <Share size={14} aria-label="Share" className="inline align-[-2px]" /> then &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
      </div>
      {mode === "install" && (
        <button onClick={install} className="min-h-[40px] shrink-0 rounded-full bg-accent px-4 text-[14px] font-semibold text-bg hover:opacity-90">
          Install
        </button>
      )}
      <button onClick={close} aria-label="Dismiss" className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line">
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
