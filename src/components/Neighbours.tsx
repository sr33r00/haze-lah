import { LEVEL_TEXT, stationLevel } from "@/lib/bands";
import type { Station } from "@/lib/types";

const NEARBY_KM = 260;

/** Malaysian stations near Singapore and modelled upwind Indonesian cities. */
export default function Neighbours({ stations }: { stations: Station[] }) {
  const list = stations.filter((s) => s.country === "ID" || s.distanceKm < NEARBY_KM).slice(0, 14);
  if (!list.length) return <p className="px-4 text-[15px] text-muted">Neighbouring readings are unavailable right now.</p>;
  return (
    <div className="px-4">
      <ul className="divide-y divide-line rounded-3xl bg-surface px-4">
        {list.map((s) => {
          const lv = stationLevel(s);
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="w-7 shrink-0 rounded-md border border-line py-0.5 text-center text-[11px] font-bold text-muted">{s.country}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{s.name}</div>
                <div className="text-[12px] text-muted">
                  {s.state}, {s.distanceKm} km away{s.country === "ID" ? ", model estimate" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-[19px] font-bold" style={{ color: lv != null ? LEVEL_TEXT[lv] : undefined }}>
                  {s.api ?? s.pm25 ?? "–"}
                </div>
                <div className="text-[11px] text-muted">{s.api != null ? "API" : "PM2.5"}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 px-1 text-[12px] text-muted">
        Malaysia&apos;s Air Pollutant Index uses the same bands as Singapore&apos;s PSI. Indonesia has no open live feed, so its cities show the Copernicus model.
      </p>
    </div>
  );
}
