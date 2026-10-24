"use client";

import { useEffect, useRef } from "react";
import { RELEASE, RELEASE_LABEL } from "@/lib/releases";
import ReleaseList from "./ReleaseList";
import SupportDialog from "./SupportDialog";

const SEEN = "seen-release";
const DELAY = 1200; // ms: let the page settle first

/**
 * A "What's new" sheet, shown once after each release to every visitor, first visits included.
 * Native dialog: focus trap and Esc come free.
 */
export default function WhatsNew() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (localStorage.getItem(SEEN) === RELEASE.version) return;
      timer = setTimeout(() => {
        if (dialog.current && !dialog.current.open) dialog.current.showModal();
      }, DELAY);
    } catch {}
    return () => clearTimeout(timer);
  }, []);

  const close = () => dialog.current?.close();
  // Every way out (Got it, Esc, backdrop, a link) ends in `close`, so mark it seen there.
  const markSeen = () => {
    try {
      localStorage.setItem(SEEN, RELEASE.version);
    } catch {}
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="whats-new-title"
      onClose={markSeen}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none animate-sheet overflow-y-auto overscroll-contain rounded-t-[28px] border border-line bg-surface p-0 text-fg backdrop:bg-black/50 lg:inset-0 lg:m-auto lg:h-fit lg:max-w-md lg:animate-rise lg:rounded-[28px]"
    >
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
        <h2 id="whats-new-title" tabIndex={-1} autoFocus className="text-[22px] font-extrabold leading-tight tracking-tight">
          New in Haze Lah
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">{RELEASE_LABEL}</p>
        <p className="mt-0.5 text-[13px] text-muted">Tap one to see it.</p>
        <div className="mt-3">
          <ReleaseList onNavigate={close} />
        </div>
        <div className="mt-3 flex flex-col items-center gap-3 text-center">
          <p className="text-balance text-[13px] leading-snug text-muted">Haze Lah is free for everyone. Supporters help keep it running.</p>
          <SupportDialog />
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-4 min-h-11 w-full rounded-full bg-accent px-5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
