import { CalendarDays, CircleGauge, Clock, Map } from "lucide-react";

const ITEMS = [
  { href: "#now", label: "Now", icon: CircleGauge },
  { href: "#plan", label: "Plan", icon: Clock },
  { href: "#forecast", label: "Forecast", icon: CalendarDays },
  { href: "#map", label: "Map", icon: Map },
];

/** Thumb-reach section navigation for phones. */
export default function BottomNav() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <a href={href} className="flex flex-col items-center gap-0.5 py-2 text-[12px] font-semibold text-muted">
              <Icon size={20} aria-hidden />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
