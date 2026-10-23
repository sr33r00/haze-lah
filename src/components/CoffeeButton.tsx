import { Coffee } from "lucide-react";
import { BMC_LABEL, BMC_URL } from "@/lib/links";

/**
 * The one Buy Me a Coffee button (their yellow, dark text). The ring and shadow keep it readable on the light and the dark surface;
 * the hover lift is motion-safe only.
 */
export default function CoffeeButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-[#ffdd00] px-6 text-[15px] font-bold text-[#0d0c22] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_-2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-black/15 transition-[transform,box-shadow,background-color] hover:bg-[#ffe84d] active:scale-[0.98] active:bg-[#f2d200] motion-safe:hover:-translate-y-px focus-visible:outline-offset-4 ${className}`}
    >
      <Coffee size={18} aria-hidden />
      {BMC_LABEL}
    </a>
  );
}
