"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

/** Short always-visible line (`lead`) with an (i) button that reveals the longer note. */
export default function InfoNote({ lead, children }: { lead?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="text-label text-muted">
      <div className="flex items-center gap-1">
        {lead}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          aria-label="More information"
          className="-m-2 grid h-9 w-9 shrink-0 place-items-center"
        >
          <Info size={14} aria-hidden />
        </button>
      </div>
      <div id={id} hidden={!open} className="animate-rise space-y-1 leading-snug">
        {children}
      </div>
    </div>
  );
}
