"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FEEDBACK_ID, FEEDBACK_URL } from "@/lib/links";

// Shown if sending fails, so the message is never lost.
const ISSUE_URL = "https://github.com/sr33r00/haze-lah/issues/new?template=feedback.yml";

type Status = "idle" | "sending" | "sent" | "error";

/** "Send feedback" pill that opens a short form in place; the message goes to the owner privately. */
export default function FeedbackForm({ pill }: { pill: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // A link to the form (FEEDBACK_URL) opens it, and clearing the hash on Cancel lets the same link work again.
  useEffect(() => {
    const fromHash = () => {
      if (location.hash !== FEEDBACK_URL) return;
      setOpen(true);
      requestAnimationFrame(() => document.getElementById(FEEDBACK_ID)?.scrollIntoView({ block: "center" }));
    };
    fromHash();
    addEventListener("hashchange", fromHash);
    return () => removeEventListener("hashchange", fromHash);
  }, []);

  const cancel = () => {
    setOpen(false);
    if (location.hash === FEEDBACK_URL) history.replaceState(null, "", location.pathname + location.search);
  };

  // Only where there is a hardware keyboard; on phones it would pop the keyboard open.
  useEffect(() => {
    if (open && matchMedia("(pointer: fine)").matches) messageRef.current?.focus();
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setStatus("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: f.get("message"), contact: f.get("contact"), website: f.get("website"), page: location.pathname }),
    }).catch(() => null);
    if (res?.ok) return setStatus("sent");
    setError((await res?.json().catch(() => null))?.error ?? "Could not send right now");
    setStatus("error");
  }

  if (!open) {
    return (
      <button id={FEEDBACK_ID} className={pill} onClick={() => setOpen(true)} aria-expanded={false}>
        <MessageSquare size={16} aria-hidden />
        Send feedback
      </button>
    );
  }

  return (
    <div id={FEEDBACK_ID} className="w-full basis-full scroll-mt-20 animate-rise rounded-3xl bg-surface p-4 text-left text-fg">
      {status === "sent" ? (
        <p className="text-label font-semibold">Thanks, your message was sent.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-label font-semibold" htmlFor="fb-message">
            What could be better?
          </label>
          <textarea
            id="fb-message"
            ref={messageRef}
            name="message"
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            className="w-full rounded-2xl border border-line bg-bg p-3 text-body"
            placeholder="A bug, an idea, something confusing…"
          />
          <input
            name="contact"
            maxLength={200}
            aria-label="Email or Telegram, optional"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="email"
            className="w-full rounded-2xl border border-line bg-bg p-3 text-body"
            placeholder="Email or Telegram for a reply (optional)"
          />
          {/* Hidden from people; bots fill it in. */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full bg-accent px-5 py-2 text-label font-semibold text-bg disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send"}
            </button>
            <button type="button" onClick={cancel} className="text-label text-muted">
              Cancel
            </button>
          </div>
          <div aria-live="polite">
            {status === "error" && (
              <p className="text-label" style={{ color: "var(--lv3)" }}>
                {error}. You can also{" "}
                <a href={ISSUE_URL} target="_blank" rel="noreferrer" className="underline">
                  post it on GitHub
                </a>
                .
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
