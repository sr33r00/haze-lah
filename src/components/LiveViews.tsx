import { MapPin } from "lucide-react";
import { REGION_POINT, type Region } from "@/lib/bands";
import { cap, fmtTime } from "@/lib/format";
import { mapLink } from "@/lib/links";
import type { Camera } from "@/lib/types";

/** Latest LTA traffic camera photos, nearest to the chosen region first; haze shows as a grey, washed-out view. */
export default function LiveViews({ cameras, region }: { cameras: Camera[]; region: Region }) {
  const [la, lo] = REGION_POINT[region];
  const sorted = [...cameras].sort((a, b) => (a.lat - la) ** 2 + (a.lon - lo) ** 2 - ((b.lat - la) ** 2 + (b.lon - lo) ** 2));
  return (
    <div>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
        {sorted.map((c) => (
          <li key={c.id} className="w-[80%] max-w-[360px] shrink-0 snap-start">
            <a href={c.image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- photos change every few minutes, so they skip image optimisation */}
              <img
                src={c.image}
                alt={`Traffic camera view at ${c.name}, ${fmtTime(c.time)}`}
                width={1920}
                height={1080}
                loading="lazy"
                decoding="async"
                className="aspect-video h-auto w-full object-cover"
              />
            </a>
            <div className="mt-1.5 flex items-start justify-between gap-2 px-1">
              <div className="min-w-0 text-[13px]">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-muted">
                  {cap(c.region)} · {fmtTime(c.time)}
                </p>
              </div>
              <a
                href={mapLink(c.lat, c.lon)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${c.name} on a map`}
                className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-line px-2.5 text-[12px] font-semibold text-accent"
              >
                <MapPin size={14} aria-hidden />
                Map
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1 px-5 text-[12px] text-muted">
        Grey, washed-out views mean haze. Photos from LTA traffic cameras via{" "}
        <a href="https://data.gov.sg" target="_blank" rel="noreferrer" className="underline">
          data.gov.sg
        </a>
        , updated every few minutes.
      </p>
    </div>
  );
}
