import { Cigarette } from "lucide-react";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES, cigarettes } from "@/lib/cigarettes";
import { cap } from "./ui";

const MAX_ICONS = 10;

/** Today's 24-hour PM2.5 as a rough cigarette equivalent. */
export default function CigaretteCard({ region, pm25 }: { region: string; pm25: number | undefined }) {
  const n = pm25 == null ? null : cigarettes(pm25);
  if (pm25 == null || n == null) return null;
  const icons = Math.min(MAX_ICONS, Math.max(1, Math.round(n)));
  const extra = Math.round(n) - MAX_ICONS;
  return (
    <div className="mx-4 mt-4 rounded-3xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="tabular text-5xl font-bold leading-none">{n}</span>
        <div className={`flex flex-wrap items-center gap-0.5 ${n < 1 ? "opacity-40" : ""}`} aria-hidden>
          {Array.from({ length: icons }, (_, i) => (
            <Cigarette key={i} size={20} />
          ))}
          {extra > 0 && <span className="ml-1 text-[13px] font-semibold">+{extra}</span>}
        </div>
      </div>
      <p className="mt-3 text-[15px]">
        Breathing {cap(region)}&apos;s air for a day is like smoking {n} {n === 1 ? "cigarette" : "cigarettes"}.
      </p>
      <p className="mt-0.5 text-[13px] text-muted">Based on today&apos;s 24-hour PM2.5 of {pm25} µg/m³.</p>
      <details className="mt-3 text-[13px]">
        <summary className="cursor-pointer font-semibold text-accent">How is this worked out?</summary>
        <p className="mt-2 text-muted">{CIGARETTE_NOTES.join(" ")}</p>
        <p className="mt-2 flex gap-3">
          {CIGARETTE_SOURCES.map(([name, url]) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-accent underline">
              {name}
            </a>
          ))}
        </p>
      </details>
    </div>
  );
}
