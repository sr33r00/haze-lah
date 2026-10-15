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
          <span className="min-w-0">
            <span className={t.kind === "help" ? "font-semibold" : ""}>{t.text}</span>
            {t.more &&
              (t.more.points.length > 0 ? (
                <details className="mt-1 text-[14px] text-muted">
                  <summary className="cursor-pointer">{t.more.label}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {t.more.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <Sources list={t.more.sources} />
                </details>
              ) : (
                <Sources list={t.more.sources} />
              ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "Source: NEA, MOH" links; shown inline when a tip has nothing else to expand. */
function Sources({ list }: { list: [string, string][] }) {
  return (
    <p className="mt-1 text-[13px] text-muted">
      Source:{" "}
      {list.map(([name, url], i) => (
        <span key={url}>
          {i > 0 && ", "}
          <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">
            {name}
          </a>
        </span>
      ))}
    </p>
  );
}
