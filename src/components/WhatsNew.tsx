"use client";

import { useEffect, useRef } from "react";
import ReleaseList from "./ReleaseList";
import { hasSeenRelease, markReleaseSeen } from "./useReleaseSeen";

const DELAY = 1200; // ms: let the page settle first

/**
 * A "What's new" sheet, shown once after each release to every visitor, first visits included.
 * Native dialog: focus trap and Esc come free.
 */
export default function WhatsNew() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (hasSeenRelease()) return;
    const timer = setTimeout(() => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    }, DELAY);
    return () => clearTimeout(timer);
  }, []);

  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      aria-labelledby="whats-new-title"
      // Every way out (Got it, Esc, backdrop, a link) ends in `close`, so mark it seen there.
      onClose={markReleaseSeen}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none animate-sheet overflow-hidden rounded-t-[28px] border border-line bg-surface p-0 text-fg backdrop:bg-black/50 open:flex open:flex-col lg:inset-0 lg:m-auto lg:h-fit lg:max-w-md lg:animate-rise lg:rounded-[28px]"
    >
      {/* The releases scroll; the title and "Got it" stay put so the button is always in reach. */}
      <div className="px-5 pt-6">
        <h2 id="whats-new-title" tabIndex={-1} autoFocus className="text-[22px] font-extrabold leading-tight tracking-tight">
          New in Haze Lah
        </h2>
        <p className="mt-0.5 text-label text-muted">Tap one to see it.</p>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        <ReleaseList onNavigate={close} />
      </div>
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={close}
          className="min-h-11 w-full btn-primary rounded-full px-5 text-label font-semibold transition-opacity"
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
