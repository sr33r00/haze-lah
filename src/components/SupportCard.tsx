import { Coffee } from "lucide-react";
import { BMC_LABEL, BMC_URL } from "@/lib/links";

/** A short, honest ask: the site is free and ad-free, and support pays for keeping it online. */
export default function SupportCard({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-4 rounded-3xl bg-surface p-4 ${className}`}>
      <p className="text-[17px] font-bold">Keep Haze Lah running</p>
      <p className="mt-1 text-[14px] leading-snug text-muted">Free, no ads, made by one person. A coffee pays for the servers and the data.</p>
      <a
        href={BMC_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-4 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90"
      >
        <Coffee size={16} aria-hidden />
        {BMC_LABEL}
      </a>
    </div>
  );
}
