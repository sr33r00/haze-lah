import { Coffee } from "lucide-react";
import Link from "next/link";
import { BMC_LABEL, BMC_URL } from "@/lib/links";
import type { Supporters } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Wei Ling, Arjun, Mei and 6 others", or "5 supporters" when no name is public. Null when there are none. */
export function supportersLine({ names, total }: Supporters): string | null {
  if (total < 1) return null;
  const shown = names.slice(0, 3);
  if (!shown.length) return plural(total, "supporter");
  const others = total - shown.length;
  const parts = others > 0 ? [...shown, plural(others, "other")] : shown;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The Buy Me a Coffee button. */
export function BmcButton() {
  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-4 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90"
    >
      <Coffee size={16} aria-hidden />
      {BMC_LABEL}
    </a>
  );
}

/** A short, honest ask: the site is free and ad-free, and support pays for keeping it online. */
export default function SupportCard({ supporters, className = "" }: { supporters: Supporters | null; className?: string }) {
  const line = supporters && supportersLine(supporters);
  return (
    <div className={`mx-4 rounded-3xl bg-surface p-4 ${className}`}>
      <p className="text-[17px] font-bold">Keep Haze Lah running</p>
      {line && <p className="mt-1 text-[14px] font-semibold leading-snug">Kept running by {line}.</p>}
      <p className="mt-1 text-[14px] leading-snug text-muted">
        Free, no ads, made by one person. A coffee pays for the servers and the data. Add your name, another name, or stay anonymous.
      </p>
      <div className="mt-3">
        <BmcButton />
      </div>
      {line && (
        <Link href="/about#supporters" className="mt-1 flex min-h-11 items-center text-[14px] font-semibold text-accent">
          See all supporters
        </Link>
      )}
    </div>
  );
}
