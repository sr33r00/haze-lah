import { Bell, Coffee } from "lucide-react";
import { ALERTS_URL, BMC_URL } from "@/lib/links";
import FeedbackForm from "./FeedbackForm";

const pill = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-fg";

/** Alerts, feedback and tip-jar links for the footer. */
export default function SupportLinks() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {ALERTS_URL && (
        <a className={pill} href={ALERTS_URL} target="_blank" rel="noreferrer">
          <Bell size={16} aria-hidden />
          Get alerts
        </a>
      )}
      <FeedbackForm pill={pill} />
      <a className={pill} href={BMC_URL} target="_blank" rel="noreferrer">
        <Coffee size={16} aria-hidden />
        Support Haze Lah
      </a>
    </div>
  );
}
