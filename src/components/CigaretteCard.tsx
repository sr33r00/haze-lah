import { BREATH_NOTES, BREATH_SOURCES, dustSoFar, fmtDust, timesNormal } from "@/lib/breath";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES, cigarettes, cigarettesSoFar, exactSoFar, packIcons } from "@/lib/cigarettes";
import type { HourPoint } from "@/lib/types";
import { cap } from "./ui";

// Pack icon sizes in px. A fresh cigarette is FILTER + PAPER tall; a smoked one is a stub (filter, STUB of crumpled paper, an ash-grey burnt end).
const CIG_W = 14;
const FILTER = 18;
const PAPER = 54; // unburnt paper above the filter
const MIN_PAPER = 10; // a lit cigarette never burns shorter than this, so it stays visible
const STUB = 10;
const CHAR = 4;
const ASH = 3;
const EMBER = 2;
const PACK_H = FILTER + PAPER + ASH + EMBER; // the row's fixed height, so nothing shifts while icons animate in (the smoke drifts above it)

/**
 * Two cigarette equivalents of PM2.5 (a day breathing it): "right now" is this hour's reading, with no icons;
 * "so far today" adds up today's hours and draws them as a pack that burns down, whole cigarettes as stubs and the
 * current one lit. Below them: times a normal day and fine dust breathed.
 */
export default function CigaretteCard({ region, pm25, today }: { region: string; pm25: number | undefined; today?: HourPoint[] }) {
  const n = pm25 == null ? null : cigarettes(pm25);
  if (pm25 == null || n == null) return null;
  const sofar = cigarettesSoFar(today);
  const exact = exactSoFar(today);
  const pack = exact != null ? packIcons(exact) : null;

  const normal = timesNormal(pm25);
  const dust = dustSoFar(today);

  return (
    <div id="everyday" className="mx-4 mt-3 scroll-mt-20 overflow-hidden rounded-3xl px-4 py-3 text-white ring-1 ring-white/10" style={{ background: "linear-gradient(160deg, #2f241d, #17120f)" }}>
      <p className="text-label text-white/70">Breathing {cap(region)}&apos;s air right now</p>
      <p className="mt-1 leading-none">
        <span className="tabular text-4xl font-extrabold">{n}</span>
        <span className="ml-1.5 text-base font-semibold">{n === 1 ? "cigarette" : "cigarettes"} a day</span>
      </p>
      <p className="mt-1.5 text-label text-white/70">1-hr PM2.5 {pm25} µg/m³</p>
      {pack && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-label text-white/70">So far today</p>
          <p className="mt-1 leading-none" suppressHydrationWarning>
            <span className="tabular text-2xl font-extrabold">About {sofar}</span>
            <span className="ml-1.5 text-base font-semibold">{sofar === 1 ? "cigarette" : "cigarettes"}</span>
          </p>
          <div className="mt-2 flex items-end gap-1.5" style={{ height: PACK_H }} aria-hidden>
            {pack.icons.map((c, i) => (
              <Cig key={i} delay={i * 60} {...c} />
            ))}
          </div>
          {pack.per > 1 && <p className="mt-1.5 text-label text-white/70">1 icon = {pack.per}</p>}
        </div>
      )}
      {normal && (
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/10 pt-3" aria-live="polite">
          <div className="min-w-0">
            <p className="tabular text-2xl font-extrabold leading-none">{normal.big}</p>
            <p className="mt-1.5 text-label text-white/70">{normal.label}</p>
          </div>
          {dust && (
            <div className="min-w-0">
              <p className="tabular text-2xl font-extrabold leading-none" suppressHydrationWarning>
                {fmtDust(dust.ug)}
              </p>
              <p className="mt-1.5 text-balance text-label text-white/70">fine dust breathed since midnight</p>
              <p className="mt-0.5 text-balance text-label text-white/70" suppressHydrationWarning>
                A normal day by now: {fmtDust(dust.normalUg)}
              </p>
            </div>
          )}
        </div>
      )}
      <details className="mt-3 text-label">
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

/** One upright cigarette: a cork filter, then a butt (smoked) or paper burnt down by `burnt` (0 to 1) under a glowing tip with smoke (lit). */
function Cig({ burnt, lit, delay }: { burnt: number; lit: boolean; delay: number }) {
  const paper = Math.max(MIN_PAPER, Math.round(PAPER * (1 - burnt)));
  return (
    <div className="relative flex shrink-0 origin-bottom animate-grow flex-col items-stretch" style={{ width: CIG_W, animationDelay: `${delay}ms` }}>
      {lit ? (
        <>
          <div className="pointer-events-none absolute bottom-full left-1/2 motion-reduce:hidden">
            {[0, 1, 2].map((k) => (
              <span
                key={k}
                className="absolute bottom-0 block h-2.5 w-2.5 animate-wisp rounded-full bg-white/40 blur-[3px]"
                style={{ marginLeft: -5, animationDelay: `${k}s` }}
              />
            ))}
          </div>
          {/* Grey ash on top, the ember glowing under it, then the paper still to burn. */}
          <div className="rounded-t-[3px] bg-[#9a948c]" style={{ height: ASH }} />
          <div className="animate-ember bg-[#ff5a1f] shadow-[0_0_8px_2px_rgba(255,90,31,0.8)]" style={{ height: EMBER }} />
          <div className="bg-[#f4efe6]" style={{ height: paper }} />
        </>
      ) : (
        <>
          <div className="rounded-t-[3px] bg-[#9a948c]" style={{ height: CHAR }} />
          <div className="bg-[#d8d0c4]" style={{ height: STUB }} />
        </>
      )}
      <div className="rounded-b-[3px] bg-[#d9822b] bg-[radial-gradient(#b8661c_1px,transparent_1px)] bg-[size:4px_4px]" style={{ height: FILTER }} />
    </div>
  );
}
