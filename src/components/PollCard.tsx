"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { CLEAN_ALERT, type PollVote } from "@/lib/poll";
import { FEEDBACK_URL } from "@/lib/links";
import { useReleaseSeen, useReturning } from "./useReleaseSeen";
import { useStored } from "./usePrefs";

/** What this browser did with the poll: "pending" until it votes (yes or no) or dismisses the card. */
type Answer = "pending" | PollVote | "dismissed";
const ANSWERS: readonly Answer[] = ["pending", "yes", "no", "dismissed"];

const button = "min-h-11 rounded-full px-5 text-label font-semibold transition-opacity disabled:opacity-60";

/**
 * "Want a message when the air turns clean?": a yes/no poll on whether an opt-in Telegram alert would be used (the votes are counted
 * anonymously by `/api/poll`). Only for returning visitors (who closed a What's new sheet on an earlier visit), and never while the What's new sheet is due or open.
 * A vote or a dismissal hides it for good; after a vote it thanks the visitor until the page is left.
 */
export default function PollCard() {
  const [answer, setAnswer] = useStored<Answer>(`poll-${CLEAN_ALERT}`, ANSWERS, "pending");
  const returning = useReturning();
  const sheetDone = useReleaseSeen();
  const [thanked, setThanked] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  async function vote(v: PollVote) {
    setStatus("sending");
    const res = await fetch("/api/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll: CLEAN_ALERT, vote: v }),
    }).catch(() => null);
    if (!res?.ok) return setStatus("error");
    setStatus("idle");
    setThanked(true);
    setAnswer(v);
  }

  if (!thanked && !(returning && sheetDone && answer === "pending")) return null;

  return (
    <div className={`relative mx-4 mt-3 rounded-3xl bg-surface ${thanked ? "px-4 py-1" : "p-4"}`}>
      {thanked ? (
        <div aria-live="polite" className="flex items-center justify-between gap-x-4">
          <p className="text-body font-bold">Thanks, noted.</p>
          <a href={FEEDBACK_URL} className="inline-flex min-h-11 items-center text-label link font-semibold">
            Suggest a feature
          </a>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setAnswer("dismissed")}
            className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
          <p className="pr-10 text-body font-bold leading-snug">Want a message when the air turns clean?</p>
          <p className="mt-1 pr-6 text-label text-muted">We&apos;re thinking of an opt-in Telegram alert for your area, so you know when it&apos;s a good time to run, cycle or hike.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={status === "sending"} onClick={() => vote("yes")} className={`${button} btn-primary`}>
              Yes, I&apos;d use it
            </button>
            <button type="button" disabled={status === "sending"} onClick={() => vote("no")} className={`${button} border border-line bg-bg text-fg hover:bg-line`}>
              Not for me
            </button>
          </div>
          <p aria-live="polite" className="mt-2 empty:hidden text-label font-semibold">
            {status === "error" && "Couldn't send. Try again."}
          </p>
        </>
      )}
    </div>
  );
}
