"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BMC_LABEL, BMC_URL } from "@/lib/links";
import { RELEASE, RELEASE_LABEL } from "@/lib/releases";

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
        <h2 id="whats-new-title" className="text-[22px] font-extrabold leading-tight tracking-tight">
          New in Haze Lah
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">{RELEASE_LABEL}</p>
        <ul className="-mx-3 mt-3">
          {RELEASE.items.map(({ title, text, href }) => (
            <li key={title}>
              <Link href={href} onClick={close} className="block min-h-11 rounded-2xl px-3 py-2.5 transition-colors hover:bg-line">
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] leading-snug text-muted">
          Supporters pay for new features like these.{" "}
          <a href={BMC_URL} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">
            {BMC_LABEL}
          </a>
        </p>
        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-3 min-h-11 w-full rounded-full bg-accent px-5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
