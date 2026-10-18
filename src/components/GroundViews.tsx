"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Webcam } from "lucide-react";
import { cap, fmtTime } from "@/lib/format";
import { nearestRegion } from "@/lib/bands";
import { OPEN_DATA_LICENCE, mapLink } from "@/lib/links";
import type { Camera, Webcam as WindyCam } from "@/lib/types";

/** One photo in the viewer, from either source. `width` caps the display size (Windy's images must not be stretched). */
type View = { key: string; title: string; area: string; image: string; href: string; lat: number; lon: number; time: string; width?: number; height?: number };

const fromCamera = (c: Camera): View => ({ key: `cam-${c.id}`, title: c.name, area: cap(c.region), image: c.image, href: c.image, lat: c.lat, lon: c.lon, time: c.time });
// Windy's terms: every image links to its webcam page and is shown no larger than it is.
const fromWebcam = (w: WindyCam): View => ({
  key: `webcam-${w.id}`,
  title: w.title,
  area: cap(nearestRegion(w.lat, w.lon)),
  image: w.image,
  href: w.page,
  lat: w.lat,
  lon: w.lon,
  time: w.time,
  width: w.width,
  height: w.height,
});

const THUMB = "block aspect-video w-full rounded-lg ring-2 ring-offset-2 ring-offset-bg transition";
const ARROW = "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm";

/** LTA road cameras and Windy webcams in one viewer: a large photo and a strip to pick from. `?cam=<id>` opens one. */
export default function GroundViews({ cameras }: { cameras: Camera[] }) {
  const [webcams, setWebcams] = useState<WindyCam[]>([]);
  const [i, setI] = useState(0);
  const views = [...cameras.map(fromCamera), ...webcams.map(fromWebcam)];

  useEffect(() => {
    fetch("/api/webcams")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWebcams)
      .catch(() => {});
    const id = new URLSearchParams(location.search).get("cam");
    const at = cameras.findIndex((c) => c.id === id);
    if (at >= 0) setI(at);
  }, [cameras]);

  if (!views.length) return <p className="px-4 text-[15px] text-muted">Camera photos are unavailable right now.</p>;
  const v = views[Math.min(i, views.length - 1)];
  const go = (d: number) => setI((n) => (n + d + views.length) % views.length);

  return (
    <div className="px-4">
      <div className="relative overflow-hidden rounded-2xl bg-fg">
        <a href={v.href} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center" aria-label={`Open ${v.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- photos change every few minutes, and Windy's URLs must be used as given */}
          <img
            key={v.key}
            src={v.image}
            alt={`Camera view at ${v.title}, ${fmtTime(v.time)}`}
            width={v.width ?? 1920}
            height={v.height ?? 1080}
            style={v.width ? { maxWidth: v.width, maxHeight: v.height } : undefined}
            className={v.width ? "h-auto max-h-full w-full object-contain" : "h-full w-full object-cover"}
          />
        </a>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10 text-white">
          <p className="truncate text-[15px] font-semibold">{v.title}</p>
          <p className="text-[12px] opacity-85">
            {v.area} · {fmtTime(v.time)}
          </p>
        </div>
        <a
          href={mapLink(v.lat, v.lon)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${v.title} on a map`}
          className="absolute right-2 top-2 flex min-h-[36px] items-center gap-1 rounded-full bg-black/50 px-3 text-[12px] font-semibold text-white backdrop-blur-sm"
        >
          <MapPin size={14} aria-hidden />
          Map
        </a>
        {views.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous camera" className={`${ARROW} left-2`}>
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button onClick={() => go(1)} aria-label="Next camera" className={`${ARROW} right-2`}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        )}
      </div>

      <ul className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 pt-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {views.map((t, n) => (
          <li key={t.key} className="w-[88px] shrink-0 snap-start sm:w-auto">
            <button onClick={() => setI(n)} aria-pressed={t.key === v.key} aria-label={t.title} className="block w-full text-left">
              {t.width ? (
                // Windy images may only appear linked to their page, so the webcam's thumbnail is a plain tile.
                <span className={`${THUMB} flex items-center justify-center bg-surface text-muted ${t.key === v.key ? "ring-fg" : "ring-transparent"}`}>
                  <Webcam size={20} aria-hidden />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- see above
                <img
                  src={t.image}
                  alt=""
                  width={160}
                  height={90}
                  loading="lazy"
                  className={`${THUMB} object-cover ${t.key === v.key ? "ring-fg" : "opacity-70 ring-transparent hover:opacity-100"}`}
                />
              )}
              <span className={`mt-1 block truncate text-[11px] font-semibold ${t.key === v.key ? "" : "text-muted"}`}>{t.area}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] text-muted">
        Grey, washed-out views mean haze. Road cameras contain information from LTA&apos;s traffic images, made available under the{" "}
        <a href={OPEN_DATA_LICENCE} target="_blank" rel="noreferrer" className="underline">
          Singapore Open Data Licence
        </a>
        .
      </p>
      {/* Windy's courtesy line, in the corner of the viewer, worded as their terms give it. */}
      {webcams.length > 0 && (
        <p className="mt-1 text-right text-[12px] text-muted">
          Webcams provided by{" "}
          <a href="https://www.windy.com/" target="_blank" rel="noreferrer" className="underline">
            windy.com
          </a>{" "}
          &mdash;{" "}
          <a href="https://www.windy.com/webcams/add" target="_blank" rel="noreferrer" className="underline">
            add a webcam
          </a>
        </p>
      )}
    </div>
  );
}
