import { Bell, Coffee, MessageSquare } from "lucide-react";

const FEEDBACK_URL = "https://github.com/sr33r00/haze-lah/issues/new?template=feedback.yml";
const BMC_URL = "https://buymeacoffee.com/hazelah";

const ALERTS_URL = process.env.NEXT_PUBLIC_ALERTS_URL;

const pill = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-fg";

/** Alerts, feedback and tip-jar links for the footer. */
export default function SupportLinks() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {ALERTS_URL?.startsWith("https://t.me/") && (
        <a className={pill} href={ALERTS_URL} target="_blank" rel="noreferrer">
          <Bell size={16} aria-hidden />
          Get alerts
        </a>
      )}
      <a className={pill} href={FEEDBACK_URL} target="_blank" rel="noreferrer">
        <MessageSquare size={16} aria-hidden />
        Send feedback
      </a>
      <a className={pill} href={BMC_URL} target="_blank" rel="noreferrer">
        <Coffee size={16} aria-hidden />
        Buy me a coffee
      </a>
    </div>
  );
}
