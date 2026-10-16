import { GUIDE } from "@/lib/guide";

/** The Guide tab: section chips, then each section's questions as accordions with official sources. */
export default function GuideView() {
  return (
    <div className="mt-4 space-y-6 px-4">
      <nav aria-label="Guide sections" className="flex flex-wrap gap-1.5">
        {GUIDE.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold">
            {s.title}
          </a>
        ))}
      </nav>
      {GUIDE.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-2">
          <h2 className="text-[18px] font-bold">{s.title}</h2>
          {s.items.map((it) => (
            <details key={it.id} id={it.id} className="scroll-mt-4 rounded-2xl bg-surface p-3 text-[15px] leading-snug">
              <summary className="cursor-pointer font-semibold">{it.q}</summary>
              <p className="mt-2">{it.a}</p>
              <p className="mt-1.5 text-[13px] text-muted">
                Source:{" "}
                {it.sources.map(([name, url], i) => (
                  <span key={url}>
                    {i > 0 && ", "}
                    <a
                      href={url}
                      {...(url.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
                      className="text-accent underline"
                    >
                      {name}
                    </a>
                  </span>
                ))}
              </p>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
