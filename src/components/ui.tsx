export { cap } from "@/lib/format";

/** A page section: plain heading on the page background, no card chrome. */
export function Section(props: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={props.id} className={`mt-10 scroll-mt-20 ${props.className ?? ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
        <h2 className="text-balance text-[22px] font-bold tracking-tight">{props.title}</h2>
        {props.aside && <div className="text-label text-muted">{props.aside}</div>}
      </div>
      {props.children}
    </section>
  );
}

/** A row of equal buttons in a rounded tray (`aria-pressed` on each, `on` saying which are pressed): a choice between views, or chips that switch things on and off. `className` places the tray. */
export function Segmented<T extends string>({ label, options, on, onSelect, className = "" }: { label: string; options: readonly { id: T; label: string }[]; on: (id: T) => boolean; onSelect: (id: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`grid gap-1 rounded-2xl bg-surface p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={on(o.id)}
          onClick={() => onSelect(o.id)}
          className={`min-h-[44px] rounded-xl px-2 text-label font-semibold leading-tight ${on(o.id) ? "bg-fg text-bg" : "text-muted hover:bg-line"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small coloured status word, e.g. a band name. */
export function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="font-semibold" style={{ color }}>
      {children}
    </span>
  );
}

/** Plain list with small round bullets instead of the browser default. */
export function Bullets({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((t) => (
        <li
          key={t}
          className="relative pl-4 before:absolute before:left-0 before:top-2.5 before:size-[5px] before:rounded-full before:bg-muted"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}
