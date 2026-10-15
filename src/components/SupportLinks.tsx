import { Coffee, MessageSquare } from "lucide-react";

const FEEDBACK_URL = "https://github.com/sr33r00/haze-lah/issues/new?template=feedback.yml";
// Set NEXT_PUBLIC_BMC_USERNAME to show the Buy Me a Coffee button.
const BMC_USER = process.env.NEXT_PUBLIC_BMC_USERNAME?.trim();
const BMC_URL = BMC_USER && /^[\w-]+$/.test(BMC_USER) ? `https://buymeacoffee.com/${BMC_USER}` : null;

const pill = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-fg";

/** Feedback and tip-jar links for the footer. */
export default function SupportLinks() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <a className={pill} href={FEEDBACK_URL} target="_blank" rel="noreferrer">
        <MessageSquare size={16} aria-hidden />
        Send feedback
      </a>
      {BMC_URL && (
        <a className={pill} href={BMC_URL} target="_blank" rel="noreferrer">
          <Coffee size={16} aria-hidden />
          Buy me a coffee
        </a>
      )}
    </div>
  );
}
