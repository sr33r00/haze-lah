"use client";

import { Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { SITE_URL } from "@/lib/links";
import { FIRE_COLOR, TRAIL_COLOR, journeyText } from "@/lib/replay";
import type { ReplayDay } from "@/lib/types";

const PICTURE = "/air-journey";

/** A fixed test file: whether the browser can share pictures is known before the real one is fetched. */
const canSharePictures = () => !!navigator.canShare?.({ files: [new File([""], "air-journey.png", { type: "image/png" })] });

/** One end of the ticket: where, and when. */
const End = ({ text, at, right }: { text: string; at: string; right?: boolean }) => (
  <div className={`min-w-0 flex-1 ${right ? "text-right" : ""}`}>
    <p className="text-[16px] font-bold leading-tight text-fg">{text}</p>
    <p className="tabular mt-1 text-[13px] text-muted">{at}</p>
  </div>
);

/** Shares the journey as a picture; where the browser cannot, opens the picture in a new tab. */
function ShareJourney({ text, onShared }: { text: string; onShared: () => void }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<File | null>(null);

  const share = async () => {
    if (!canSharePictures()) {
      window.open(PICTURE, "_blank", "noopener");
      setStatus("The picture opened in a new tab.");
      return;
    }
    setBusy(true);
    setStatus("Making the picture.");
    try {
      if (!file.current) {
        const res = await fetch(PICTURE);
        if (!res.ok) throw new Error("picture");
        file.current = new File([await res.blob()], "air-journey.png", { type: "image/png" });
      }
      await navigator.share({ files: [file.current], title: "Today's air in Singapore", text, url: `${SITE_URL}/#origin` });
      setStatus("");
      onShared();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      // The phone wants a fresh tap once the picture is ready; it is kept for that tap.
      setStatus(name === "AbortError" ? "" : name === "NotAllowedError" && file.current ? "The picture is ready. Tap Share again." : "Could not share. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        aria-busy={busy}
        aria-label="Share the journey as a picture"
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-bg px-4 text-[15px] font-semibold transition-colors hover:bg-line disabled:opacity-60"
      >
        <Share2 size={18} aria-hidden />
        Share picture
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </>
  );
}

/** The air's journey as a travel ticket: where it left, where it arrived and the fires it passed. Null on calm days, when the air stayed near Singapore. Only today's can be shared as a picture (`shareable`). */
export default function AirJourney({ day, shareable = true }: { day: ReplayDay; shareable?: boolean }) {
  const [shared, setShared] = useState(false);
  const t = journeyText(day);
  if (!t) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <End text={t.left} at={t.leftAt} />
          <End text={t.reached} at={t.reachedAt} right />
        </div>
        <div className="relative mx-1 mt-4 border-t-2 border-dashed" style={{ borderColor: TRAIL_COLOR }}>
          <span aria-hidden className="absolute -left-1.5 -top-[7px] size-3 rounded-full border-2 bg-surface" style={{ borderColor: TRAIL_COLOR }} />
          <span aria-hidden className="absolute -right-1.5 -top-[7px] size-3 rounded-full" style={{ background: TRAIL_COLOR }} />
          <p className="tabular absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-surface px-2 text-[13px] font-semibold">{t.trip}</p>
        </div>
      </div>
      <div className="relative mt-4 border-t border-dashed border-line">
        <span aria-hidden className="absolute -left-2 -top-2 size-4 rounded-full border border-line bg-bg" />
        <span aria-hidden className="absolute -right-2 -top-2 size-4 rounded-full border border-line bg-bg" />
      </div>
      <div className="flex min-h-[3.75rem] items-center justify-between gap-3 px-4 py-2">
        <p className="flex items-center gap-2 text-[15px] font-bold">
          {day.near > 0 && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: FIRE_COLOR }} />}
          {t.fires}
        </p>
        {shareable && <ShareJourney text={`Today's air travelled ${t.trip} to reach Singapore.`} onShared={() => setShared(true)} />}
      </div>
      <div aria-live="polite" className={`px-4 text-[13px] leading-snug text-muted ${shared ? "pb-3" : ""}`}>
        {shared && "Thanks for sharing."}
      </div>
    </div>
  );
}
