import { LocateFixed } from "lucide-react";
import { REGIONS, airMark, pm25Color, type Region } from "@/lib/bands";
import type { NeaPm25History } from "@/lib/types";
import { cap } from "./ui";

/** Region switcher; each chip carries that region's live 1-hr PM2.5. */
export default function RegionChips(props: {
  history: NeaPm25History | null;
  region: Region;
  onPick: (r: Region) => void;
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <>
      <div role="group" className="mt-3 flex gap-1.5 px-4" aria-label="Choose your part of Singapore">
        <button
          onClick={props.onLocate}
          aria-label="Use my location"
          title="Use my location"
          className="grid w-10 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-muted"
        >
          <LocateFixed size={18} aria-hidden className={props.locating ? "animate-pulse" : ""} />
        </button>
        {REGIONS.map((r) => {
          const v = props.history?.regions[r].at(-1)?.value;
          const on = r === props.region;
          return (
            <button
              key={r}
              onClick={() => props.onPick(r)}
              aria-pressed={on}
              aria-label={`${cap(r)}${v != null ? `, PM2.5 ${Math.round(v)}` : ""}`}
              className={`min-w-0 flex-1 rounded-2xl border bg-surface px-0 pb-2 pt-1.5 text-center transition-colors ${
                on ? "border-fg ring-1 ring-inset ring-fg" : "border-line"
              }`}
            >
              <span className="block text-label leading-tight text-muted">{cap(r)}</span>
              <span className="tabular block text-label font-bold leading-tight">{v != null ? Math.round(v) : "–"}</span>
              <span
                aria-hidden
                className="mx-auto mt-1 block h-1 w-6 rounded-full"
                style={v != null ? airMark(pm25Color(v)) : { background: "transparent" }}
              />
            </button>
          );
        })}
      </div>
      {/* The chips show PM2.5, not PSI; say so, since the hero shows both. */}
      <p className="mt-1 px-4 text-right text-label text-muted">PM2.5 now, µg/m³</p>
    </>
  );
}
