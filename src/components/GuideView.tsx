import { Briefcase, ChevronDown, ChevronRight, House, Info, School, ShieldCheck, Stethoscope, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { GUIDE } from "@/lib/guide";
import OpenFromHash from "./OpenFromHash";
import SectionNav from "./SectionNav";
import { Bullets } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  outdoors: Sun,
  masks: ShieldCheck,
  home: House,
  school: School,
  work: Briefcase,
  health: Stethoscope,
};

/** The Guide tab: section links, then each section's questions as one grouped list of accordions with official sources. */
export default function GuideView() {
  const sections = GUIDE.map((s) => ({ id: s.id, title: s.title, icon: ICONS[s.id] }));
  return (
    <div className="mt-4 px-4 pb-10">
      <p className="text-body text-muted">Short answers from NEA, MOH, MOE and MOM. Tap a question to open it.</p>
      <div className="mt-4 space-y-8 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-10 lg:space-y-0">
        <SectionNav label="Guide sections" sections={sections} />
        <div className="max-w-2xl space-y-8 xl:max-w-none xl:columns-2 xl:gap-8 xl:space-y-0 xl:[&>*]:mb-8 xl:[&>*]:break-inside-avoid">
          {GUIDE.map((s) => {
            const Icon = ICONS[s.id];
            return (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <h2 className="mb-3 flex items-center gap-2 text-[20px] font-bold">
                  {Icon && <Icon size={20} aria-hidden className="text-muted" />}
                  {s.title}
                </h2>
                <div className="divide-y divide-line rounded-2xl bg-surface">
                  {s.items.map((it) => (
                    <details key={it.id} id={it.id} className="group scroll-mt-20">
                      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:rounded-xl focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
                        <span className="text-body font-semibold leading-snug">{it.q}</span>
                        <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-4 pb-4">
                        <p className="text-body font-medium leading-relaxed">{it.a}</p>
                        {it.points && <Bullets items={it.points} className="mt-2 text-body leading-relaxed" />}
                        <p className="mt-3 text-label text-muted">
                          Source:{" "}
                          {it.sources.map(([name, url], i) => (
                            <span key={url}>
                              {i > 0 && " · "}
                              <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">
                                {name}
                              </a>
                            </span>
                          ))}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
          <Link href="/about" className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface p-4 text-label font-semibold">
            <Info size={18} aria-hidden className="shrink-0 text-muted" />
            <span className="flex-1">How this site works and where the data comes from</span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
          </Link>
        </div>
      </div>
      <OpenFromHash />
    </div>
  );
}
