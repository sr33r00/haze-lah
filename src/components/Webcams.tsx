"use client";

import { useEffect, useState } from "react";
import { cap, fmtTime } from "@/lib/format";
import { nearestRegion } from "@/lib/bands";
import type { Webcam } from "@/lib/types";
import { Section } from "./ui";

/** Windy webcams near Singapore. Hidden until loaded, and when there are none. */
export default function Webcams() {
  const [cams, setCams] = useState<Webcam[]>([]);
  useEffect(() => {
    fetch("/api/webcams")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCams)
      .catch(() => {});
  }, []);
  if (!cams.length) return null;
  return (
    <Section title="Webcams">
      <ul className="grid gap-4 px-4 sm:grid-cols-2">
        {cams.map((c) => (
          <li key={c.id}>
            {/* Windy's terms: link every image to its webcam page and never show it larger than it is. */}
            <a href={c.page} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-line" style={{ maxWidth: c.width }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Windy's URLs must be used as given */}
              <img src={c.image} alt={`Webcam view, ${c.title}`} width={c.width} height={c.height} loading="lazy" className="h-auto w-full" />
            </a>
            <p className="mt-1.5 px-1 text-[13px]">
              <span className="font-semibold">{c.title}</span>
              <span className="block text-muted">
                {cap(nearestRegion(c.lat, c.lon))} · {fmtTime(c.time)}
              </span>
            </p>
          </li>
        ))}
      </ul>
      {/* Windy's courtesy line, in the corner of the webcams, worded as their terms give it. */}
      <p className="mt-2 px-5 text-right text-[12px] text-muted">
        Webcams provided by{" "}
        <a href="https://www.windy.com/" target="_blank" rel="noreferrer" className="underline">
          windy.com
        </a>{" "}
        &mdash;{" "}
        <a href="https://www.windy.com/webcams/add" target="_blank" rel="noreferrer" className="underline">
          add a webcam
        </a>
      </p>
    </Section>
  );
}
