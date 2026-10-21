import { BREATH_NOTES, BREATH_SOURCES, dustSoFar, fmtDust, timesNormal } from "@/lib/breath";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES, cigarettes, cigarettesSoFar, exactSoFar } from "@/lib/cigarettes";
import type { HourPoint } from "@/lib/types";
import { cap } from "./ui";

const MAX_ICONS = 10;
const PAPER = 30; // px of unburnt paper above the filter

/**
 * Today's 24-hour PM2.5 as a rough cigarette equivalent, drawn as a pack that burns down through the day:
 * cigarettes already "smoked" by this hour are stubs, the current one is lit.
 */
export default function CigaretteCard({ region, pm25, today }: { region: string; pm25: number | undefined; today?: HourPoint[] }) {
  const n = pm25 == null ? null : cigarettes(pm25);
  if (pm25 == null || n == null) return null;
  const sofar = cigarettesSoFar(today);
  const icons = Math.min(MAX_ICONS, Math.max(1, Math.round(n)));
  const extra = Math.round(n) - MAX_ICONS;
  // Each icon stands for one cigarette, or n / 10 of them when there are more than ten.
  const per = n > MAX_ICONS ? n / MAX_ICONS : 1;
  const exact = exactSoFar(today);
  const burnt = exact != null ? exact / per : null;

  const normal = timesNormal(pm25);
  const dust = dustSoFar(today);

  const notes = [sofar != null ? `About ${sofar} so far` : null, `24-hr PM2.5 ${pm25} µg/m³`, extra > 0 ? `1 icon = ${Math.round(per * 10) / 10}` : null].filter(Boolean);

  return (
    <div id="everyday" className="mx-4 mt-3 scroll-mt-20 overflow-hidden rounded-3xl px-4 py-3 text-white ring-1 ring-white/10" style={{ background: "linear-gradient(160deg, #2f241d, #17120f)" }}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white/70">Today in {cap(region)}, like smoking</p>
          <p className="mt-1 leading-none">
            <span className="tabular text-4xl font-extrabold">{n}</span>
            <span className="ml-1.5 text-base font-semibold">{n === 1 ? "cigarette" : "cigarettes"}</span>
          </p>
          <p className="mt-1.5 text-[12px] text-white/70" suppressHydrationWarning>
            {notes.join(" · ")}
          </p>
        </div>
        <div className="flex h-[52px] shrink-0 items-end gap-1" aria-hidden>
          {Array.from({ length: icons }, (_, i) => (
            <Cig
              key={i}
              delay={i * 60}
              length={n < 1 ? Math.max(0.2, n) : 1}
              burnt={burnt == null ? 0 : Math.min(1, Math.max(0, burnt - i))}
              lit={burnt != null && Math.floor(burnt) === i}
            />
          ))}
        </div>
      </div>
      {normal && (
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/10 pt-3" aria-live="polite">
          <div className="min-w-0">
            <p className="tabular text-2xl font-extrabold leading-none">{normal.big}</p>
            <p className="mt-1.5 text-[12px] text-white/70">{normal.label}</p>
          </div>
          {dust && (
            <div className="min-w-0">
              <p className="tabular text-2xl font-extrabold leading-none" suppressHydrationWarning>
                {fmtDust(dust.ug)}
              </p>
              <p className="mt-1.5 text-balance text-[12px] text-white/70">fine dust breathed since midnight</p>
              <p className="mt-0.5 text-balance text-[12px] text-white/70" suppressHydrationWarning>
                A normal day by now: {fmtDust(dust.normalUg)}
              </p>
            </div>
          )}
        </div>
      )}
      <details className="mt-3 text-[12px]">
        <summary className="cursor-pointer font-semibold text-[#ffb27a]">How is this worked out?</summary>
        <p className="mt-2 text-white/75">{CIGARETTE_NOTES.join(" ")}</p>
        {BREATH_NOTES.map((t) => (
          <p key={t} className="mt-2 text-white/75">
            {t}
          </p>
        ))}
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {[...CIGARETTE_SOURCES, ...BREATH_SOURCES].map(([name, url]) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[#ffb27a] underline">
              {name}
            </a>
          ))}
        </p>
      </details>
    </div>
  );
}

/** One upright cigarette: filter, paper burnt down by `burnt` (0 to 1), and a glowing tip with smoke when lit. */
function Cig({ burnt, lit, length, delay }: { burnt: number; lit: boolean; length: number; delay: number }) {
  const paper = Math.round(PAPER * length * (1 - burnt));
  const done = burnt >= 1;
  return (
    <div className="relative flex w-2.5 origin-bottom animate-grow flex-col items-stretch" style={{ animationDelay: `${delay}ms` }}>
      {lit && (
        <div className="pointer-events-none absolute -top-3 left-1/2">
          {[0, 1, 2].map((k) => (
            <span
              key={k}
              className="absolute block h-2.5 w-2.5 animate-wisp rounded-full bg-white/40 blur-[3px]"
              style={{ marginLeft: -5, animationDelay: `${k}s` }}
            />
          ))}
        </div>
      )}
      {!done && paper > 0 && (
        <>
          {/* Burnt cigarettes end in grey ash; the lit one glows under it. */}
          {burnt > 0 && <div className="h-1 rounded-t-sm bg-[#9a948c]" />}
          {lit && <div className="h-1 animate-ember bg-[#ff5a1f] shadow-[0_0_8px_2px_rgba(255,90,31,0.8)]" />}
          <div className={`bg-[#f4efe6] ${burnt > 0 ? "" : "rounded-t-sm"}`} style={{ height: paper }} />
        </>
      )}
      {done && <div className="h-1 rounded-t-sm bg-[#4a3f38]" />}
      <div className="h-[12px] rounded-b-sm bg-[#d9822b] bg-[radial-gradient(#b8661c_1px,transparent_1px)] bg-[size:4px_4px]" />
    </div>
  );
}
