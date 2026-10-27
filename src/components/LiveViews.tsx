import Link from "next/link";
import { REGION_POINT, type Region } from "@/lib/bands";
import { cap, fmtTime } from "@/lib/format";
import { OPEN_DATA_LICENCE } from "@/lib/links";
import type { Camera } from "@/lib/types";

const byDistance = (cameras: Camera[], [la, lo]: [number, number]) =>
  [...cameras].sort((a, b) => (a.lat - la) ** 2 + (a.lon - lo) ** 2 - ((b.lat - la) ** 2 + (b.lon - lo) ** 2));

/** Latest LTA traffic camera photos, nearest to the chosen region first; each opens in the Photos viewer. */
export default function LiveViews({ cameras, region }: { cameras: Camera[]; region?: Region }) {
  const sorted = region ? byDistance(cameras, REGION_POINT[region]) : cameras;
  return (
    <div>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
        {sorted.map((c) => (
          <li key={c.id} className="w-[75%] max-w-[320px] shrink-0 snap-start">
            <Link href={`/photos?cam=${c.id}#ground`} className="relative block overflow-hidden rounded-2xl bg-line">
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
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-white">
                <span className="block truncate text-label font-semibold">{c.name}</span>
                <span className="block text-label opacity-85">
                  {cap(c.region)} · {fmtTime(c.time)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1 px-5 text-label text-muted">
        Grey, washed-out views mean haze. Contains information from LTA&apos;s traffic images, made available under the{" "}
        <a href={OPEN_DATA_LICENCE} target="_blank" rel="noreferrer" className="link">
          Singapore Open Data Licence
        </a>
        .
      </p>
    </div>
  );
}
