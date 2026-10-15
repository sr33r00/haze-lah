export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A page section: plain heading on the page background, no card chrome. */
export function Section(props: { id?: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={props.id} className={`mt-10 scroll-mt-4 ${props.className ?? ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
        <h2 className="text-[22px] font-bold tracking-tight">{props.title}</h2>
        {props.aside && <div className="text-[13px] text-muted">{props.aside}</div>}
      </div>
      {props.children}
    </section>
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
