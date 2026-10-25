import type { LucideIcon } from "lucide-react";

type NavSection = { id: string; title: string; icon?: LucideIcon };

/** Anchor chips that jump between sections: a wrapping row on phones, a sticky list in the left column at lg. */
export default function SectionNav({ label, sections }: { label: string; sections: NavSection[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5 lg:sticky lg:top-20 lg:flex-col lg:flex-nowrap lg:gap-0.5 lg:self-start">
      {sections.map(({ id, title, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-label font-semibold lg:rounded-xl lg:bg-transparent lg:hover:bg-surface"
        >
          {Icon && <Icon size={14} aria-hidden className="shrink-0 text-muted" />}
          {title}
        </a>
      ))}
    </nav>
  );
}
