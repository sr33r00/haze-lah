"use client";

import { Coffee, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { SUPPORT_EMBED_URL, SUPPORT_ICON_LABEL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/links";

type Variant = "button" | "icon" | "link";

// The pill is coffee brown with white text. The ring and shadow keep it readable on the light and the dark surface; the hover lift is motion-safe only.
const TRIGGER: Record<Variant, string> = {
  button:
    "inline-flex min-h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-[#6f4e37] px-6 text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_-2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-white/15 transition-[transform,box-shadow,background-color] hover:bg-[#7d5a41] active:scale-[0.98] active:bg-[#5e412d] motion-safe:hover:-translate-y-px focus-visible:outline-offset-4",
  icon: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line",
  link: "font-semibold text-accent underline",
};

/**
 * The one Ko-fi support control: a trigger (the coffee-brown pill, the title-bar icon or an inline text link) and the dialog it opens,
 * which embeds Ko-fi's donation panel so visitors donate without leaving the site.
 * The trigger stays a real link to Ko-fi, so middle-click, cmd-click and no-JS still open it in a new tab.
 * Native dialog: focus trap, Esc and focus return come free. Ko-fi loads only once the dialog is first opened.
 */
export default function SupportDialog({ variant = "button", className = "" }: { variant?: Variant; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [opened, setOpened] = useState(false);

  const open = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpened(true);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        onClick={open}
        aria-label={variant === "icon" ? SUPPORT_ICON_LABEL : undefined}
        title={variant === "icon" ? SUPPORT_ICON_LABEL : undefined}
        className={`${TRIGGER[variant]} ${className}`}
      >
        {variant !== "link" && <Coffee size={variant === "icon" ? 16 : 18} aria-hidden />}
        {variant !== "icon" && SUPPORT_LABEL}
      </a>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] animate-rise overflow-y-auto overscroll-contain rounded-[28px] border border-coffee-line bg-coffee p-0 text-coffee-fg backdrop:bg-black/50"
      >
        <div className="px-5 pb-5 pt-6">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-coffee-line"
          >
            <X size={20} aria-hidden />
          </button>
          <span aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#6f4e37] text-white shadow-[0_2px_8px_rgba(59,38,24,0.35)]">
            <Coffee size={24} />
          </span>
          <h2 id={titleId} tabIndex={-1} autoFocus className="pr-9 text-[22px] font-extrabold leading-tight tracking-tight">
            Be part of Haze Lah
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-coffee-muted">Your coffee pays for the servers and new features. You&apos;re part of the reason Haze Lah exists.</p>
          {/* Ko-fi's panel is light, so it sits on white in the dark theme too. */}
          <iframe
            src={opened ? SUPPORT_EMBED_URL : undefined}
            title={SUPPORT_ICON_LABEL}
            allow="payment"
            className="mt-4 block h-[min(640px,70dvh)] w-full rounded-2xl border-0 bg-white ring-1 ring-coffee-line"
          />
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex min-h-11 items-center justify-center text-[13px] font-semibold text-coffee-muted underline"
          >
            Open Ko-fi in a new tab
          </a>
        </div>
      </dialog>
    </>
  );
}
