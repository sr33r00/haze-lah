import { Activity, Baby, HeartPulse, House, Pill, ShieldCheck, Users } from "lucide-react";
import type { Tip } from "@/lib/advice";

const ICON: Record<Tip["kind"], React.ReactNode> = {
  home: <House size={20} />,
  mask: <ShieldCheck size={20} />,
  child: <Baby size={20} />,
  meds: <Pill size={20} />,
  people: <Users size={20} />,
  help: <HeartPulse size={20} />,
  exercise: <Activity size={20} />,
};

export default function Advice({ items }: { items: Tip[] }) {
  return (
    <ul className="mx-4 space-y-3">
      {items.map((t) => (
        <li key={t.kind} className="flex gap-3 text-[15px] leading-snug">
          <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
            {ICON[t.kind]}
          </span>
          <span className={t.kind === "help" ? "font-semibold" : ""}>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}
