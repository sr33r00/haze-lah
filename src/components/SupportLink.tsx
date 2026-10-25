import { Coffee } from "lucide-react";
import { SUPPORT_ICON_LABEL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/links";

type Variant = "button" | "icon" | "link";

// The pill is coffee brown with white text. The ring and shadow keep it readable on the light and the dark surface; the hover lift is motion-safe only.
const STYLE: Record<Variant, string> = {
  button:
    "inline-flex min-h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-[#6f4e37] px-6 text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_-2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-white/15 transition-[transform,box-shadow,background-color] hover:bg-[#7d5a41] active:scale-[0.98] active:bg-[#5e412d] motion-safe:hover:-translate-y-px focus-visible:outline-offset-4",
  icon: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line",
  link: "font-semibold text-accent underline",
};

/** The one Ko-fi support control (the coffee-brown pill, the title-bar icon or an inline text link): opens the Ko-fi page in a new tab. */
export default function SupportLink({ variant = "button", className = "" }: { variant?: Variant; className?: string }) {
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={variant === "icon" ? SUPPORT_ICON_LABEL : undefined}
      title={variant === "icon" ? SUPPORT_ICON_LABEL : undefined}
      className={`${STYLE[variant]} ${className}`}
    >
      {variant !== "link" && <Coffee size={variant === "icon" ? 16 : 18} aria-hidden />}
      {variant !== "icon" && SUPPORT_LABEL}
    </a>
  );
}
