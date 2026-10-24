"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SAT_ASPECT, SAT_SIZE, onImage } from "@/lib/satellite";
import { SG } from "@/lib/util";

/** A small label pinned to a left corner of a picture (`at` the top or the bottom): a span, so it can sit inside a button. */
export function Chip({ at, children }: { at: "top" | "bottom"; children: React.ReactNode }) {
  return (
    <span
      className={`tabular absolute left-2 rounded-lg bg-black/60 px-2 py-1 text-[13px] font-semibold text-white ${at === "top" ? "top-2" : "bottom-2"}`}
    >
      {children}
    </span>
  );
}

/** What stands in the picture's box instead of the picture when it cannot be shown: a span, so it can sit inside a button. */
export function PictureNote({ children }: { children: React.ReactNode }) {
  return <span className="absolute inset-0 grid place-items-center p-4 text-center text-[15px] text-white/80">{children}</span>;
}

/** The picture's box while it waits to load, the same shape so that nothing shifts. */
export function PictureSkeleton() {
  return <div className="animate-pulse rounded-2xl bg-line" style={{ aspectRatio: SAT_ASPECT }} />;
}

/**
 * A picture of `SAT_BOX` with a button over it that opens the same picture full screen: a native dialog on black, panned and
 * pinch-zoomed by scrolling. `inline` and `full` are what fills the picture's box in each place (spans only: the inline one sits inside a button).
 * `chips` stay put in the corners of the screen in the dialog (not on the part of the picture that scrolls away on a phone), and
 * `controls` go under it. `name` says what the picture is.
 */
export default function FullScreenPicture({ name, disabled, inline, full, chips, controls }: { name: string; disabled: boolean; inline: React.ReactNode; full: React.ReactNode; chips: React.ReactNode; controls: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Where it opens on a phone, where the picture is wider than the screen: Singapore in the middle.
  useEffect(() => {
    const el = scroller.current;
    if (open && el) el.scrollLeft = (el.scrollWidth * onImage(SG.lat, SG.lon).x) / 100 - el.clientWidth / 2;
  }, [open]);

  const close = () => dialog.current?.close();
  const backdrop = (e: React.MouseEvent) => e.target === e.currentTarget && close(); // the dialog itself, or the black around the picture
  return (
    <>
      <button
        type="button"
        aria-label="View full screen"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-black disabled:cursor-default"
        style={{ aspectRatio: SAT_ASPECT }}
      >
        {inline}
        {chips}
        {!disabled && (
          <span aria-hidden className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
            <Maximize2 size={16} />
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        aria-label={`${name}, full screen`}
        onClose={() => setOpen(false)}
        onClick={backdrop}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col overflow-hidden border-0 bg-black p-0 text-white open:flex backdrop:bg-black"
      >
        {open && (
          <>
            <div className="relative min-h-0 flex-1">
              {/* Wide enough to pan: on a phone held upright the picture is as tall as the screen; elsewhere it fits. touch-action leaves the browser's own pinch-zoom on. */}
              <div
                ref={scroller}
                tabIndex={0}
                aria-label={name}
                onClick={backdrop}
                className="absolute inset-0 flex touch-pan-x touch-pan-y touch-pinch-zoom overflow-auto overscroll-contain [container-type:size]"
              >
                <div
                  className="relative m-auto w-[min(100cqw,calc(100cqh*var(--ar)))] shrink-0 pointer-coarse:portrait:h-[100cqh] pointer-coarse:portrait:w-auto"
                  style={{ aspectRatio: SAT_ASPECT, "--ar": SAT_SIZE.w / SAT_SIZE.h } as React.CSSProperties}
                >
                  {full}
                </div>
              </div>
              {/* The chips' corners are those of the screen, kept clear of a notch. */}
              <div className="pointer-events-none absolute bottom-0 left-[env(safe-area-inset-left)] right-0 top-[env(safe-area-inset-top)]">{chips}</div>
              <button
                type="button"
                onClick={close}
                autoFocus
                aria-label="Close"
                className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20"
              >
                <X size={20} aria-hidden />
              </button>
              <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[13px] text-white pointer-coarse:block">Pinch to zoom</p>
            </div>
            <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:px-6">{controls}</div>
          </>
        )}
      </dialog>
    </>
  );
}
