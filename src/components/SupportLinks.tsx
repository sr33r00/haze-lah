import { Bell } from "lucide-react";
import { ALERTS_URL } from "@/lib/links";
import FeedbackForm from "./FeedbackForm";

const pill = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-label font-semibold text-fg";

/** Alerts and feedback links for the footer. */
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
    </div>
  );
}
