import { LEVEL_COLOR, psiLevel, type Region } from "@/lib/bands";
import type { NeaNow } from "@/lib/types";

const POLLUTANTS: { key: keyof NeaNow["sub"]; name: string; note: string }[] = [
  { key: "pm25", name: "PM2.5", note: "Fine smoke particles, 24-hour average" },
  { key: "pm10", name: "PM10", note: "Coarser dust and smoke, 24-hour average" },
  { key: "o3", name: "Ozone", note: "8-hour maximum" },
  { key: "co", name: "Carbon monoxide", note: "8-hour maximum" },
  { key: "so2", name: "Sulphur dioxide", note: "24-hour average" },
];

/** PSI sub-index for each pollutant in one region; the highest sets the PSI. */
export default function AirDetail({ nea, region }: { nea: NeaNow; region: Region }) {
  const max = 300;
  return (
    <div className="mx-4 rounded-3xl bg-surface p-4">
      <ul className="space-y-3">
        {POLLUTANTS.map((p, i) => {
          const v = nea.sub[p.key][region];
          const ok = !isNaN(v);
          return (
            <li key={p.key}>
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="font-semibold">{p.name}</span>
                <span className="tabular font-bold">{ok ? v : "–"}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-line">
                {ok && (
                  <div
                    className="h-2 origin-left animate-grow-x rounded-full"
                    style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: LEVEL_COLOR[psiLevel(v)], animationDelay: `${i * 80}ms` }}
                  />
                )}
              </div>
              <div className="mt-0.5 text-[12px] text-muted">{p.note}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13px] text-muted">
        Concentrations: PM2.5 <b className="tabular text-fg">{fmt(nea.pm25_24h[region])}</b>, PM10 <b className="tabular text-fg">{fmt(nea.pm10_24h[region])}</b>, nitrogen
        dioxide <b className="tabular text-fg">{fmt(nea.no2_1h_max[region])}</b> µg/m³. Bars show each pollutant&apos;s PSI sub-index; the highest one is the PSI.
      </p>
    </div>
  );
}

const fmt = (v: number) => (isNaN(v) ? "–" : String(v));
