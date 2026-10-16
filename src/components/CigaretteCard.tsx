import { CIGARETTE_NOTES, CIGARETTE_SOURCES, cigarettes, cigarettesSoFar, exactSoFar } from "@/lib/cigarettes";
import type { HourPoint } from "@/lib/types";
import { cap } from "./ui";

const MAX_ICONS = 10;
const PAPER = 52; // px of unburnt paper above the filter

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

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-3xl p-4 text-white ring-1 ring-white/10" style={{ background: "linear-gradient(160deg, #2f241d, #17120f)" }}>
      <p className="text-[13px] text-white/70">Today in {cap(region)}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="leading-none">
          <span className="tabular text-6xl font-extrabold">{n}</span>
          <span className="ml-2 text-lg font-semibold">{n === 1 ? "cigarette" : "cigarettes"}</span>
        </p>
        {extra > 0 && <span className="text-[13px] text-white/70">1 icon = {Math.round(per * 10) / 10}</span>}
      </div>

      <div className="mt-4 flex h-[84px] items-end gap-2" aria-hidden>
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

      <p className="mt-3 text-[15px]">
        Breathing {cap(region)}&apos;s air for a day is like smoking {n} {n === 1 ? "cigarette" : "cigarettes"}.
      </p>
      <p className="mt-0.5 text-[13px] text-white/70" suppressHydrationWarning>
        {sofar != null ? `About ${sofar} so far today. ` : ""}From today&apos;s 24-hour PM2.5 of {pm25} µg/m³.
      </p>
      <details className="mt-3 text-[13px]">
        <summary className="cursor-pointer font-semibold text-[#ffb27a]">How is this worked out?</summary>
        <p className="mt-2 text-white/75">{CIGARETTE_NOTES.join(" ")}</p>
        <p className="mt-2 flex gap-3">
          {CIGARETTE_SOURCES.map(([name, url]) => (
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
    <div className="relative flex w-4 origin-bottom animate-grow flex-col items-stretch" style={{ animationDelay: `${delay}ms` }}>
      {lit && (
        <div className="pointer-events-none absolute -top-3 left-1/2">
          {[0, 1, 2].map((k) => (
            <span
              key={k}
              className="absolute block h-3 w-3 animate-wisp rounded-full bg-white/40 blur-[3px]"
              style={{ marginLeft: -6, animationDelay: `${k}s` }}
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
      <div className="h-[22px] rounded-b-sm bg-[#d9822b] bg-[radial-gradient(#b8661c_1px,transparent_1px)] bg-[size:4px_4px]" />
    </div>
  );
}
