import { LEVEL_TEXT, REGIONS, psiLevel, type Region } from "@/lib/bands";
import type { HazeData } from "@/lib/types";
import { Card, cap } from "./ui";

export default function Regions({ data, region, onPick }: { data: HazeData; region: Region; onPick: (r: Region) => void }) {
  if (!data.nea) return null;
  return (
    <Card title="Across Singapore">
      <div className="grid grid-cols-5 gap-2 text-center">
        {REGIONS.map((r) => {
          const p = data.nea!.psi24[r];
          const pm = data.history?.regions[r].at(-1)?.value;
          const ok = !isNaN(p);
          return (
            <button key={r} onClick={() => onPick(r)} aria-pressed={r === region} className={`rounded-2xl p-2 ${r === region ? "ring-2 ring-fg" : ""}`}>
              <div className="text-[11px] text-muted">{cap(r)}</div>
              <div className="tabular text-lg font-bold" style={{ color: ok ? LEVEL_TEXT[psiLevel(p)] : undefined }}>
                {ok ? p : "–"}
              </div>
              <div className="tabular text-[10px] text-muted">{pm != null ? `${Math.round(pm)} µg` : ""}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">24-hr PSI (big) and 1-hr PM2.5 (small).</p>
    </Card>
  );
}
