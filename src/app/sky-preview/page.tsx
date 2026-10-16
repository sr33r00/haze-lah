"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import type { Group } from "@/lib/bands";
import type { ForecastPoint } from "@/lib/types";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const at = (h: number) => `${today}T${String(h % 24).padStart(2, "0")}:00:00+08:00`;

/** Six hourly points after `from`, wobbling around `pm`. */
const next = (pm: number, from: number): ForecastPoint[] =>
  [0, 4, -3, 6, 2, -5].map((d, i) => {
    const v = Math.max(1, Math.round(pm + (d * pm) / 40));
    return { time: at(from + i + 1), pm25: v, low: Math.round(v * 0.8), high: Math.round(v * 1.25), raw: v, pHigh: v > 55 ? 0.8 : 0.1 };
  });

const STATES = [
  { label: "Good, day", pm25: 18, psi: 38, hour: 14 },
  { label: "Elevated, day", pm25: 80, psi: 88, hour: 14 },
  { label: "Unhealthy, day", pm25: 108, psi: 194, hour: 14 },
  { label: "Hazardous, day", pm25: 280, psi: 320, hour: 14 },
  { label: "Unhealthy, night", pm25: 108, psi: 194, hour: 21 },
  { label: "No reading", pm25: null, psi: null, hour: null },
];

export default function SkyPreview() {
  const [group, setGroup] = useState<Group>("healthy");
  return (
    <main className="mx-auto max-w-lg pb-16">
      {STATES.map((s) => (
        <div key={s.label} className="mt-8">
          <p className="px-4 text-[13px] font-semibold text-muted">{s.label}</p>
          <Hero
            region="central"
            readingTime={s.hour != null ? at(s.hour) : null}
            pm25={s.pm25}
            psi={s.psi}
            trend="Steady"
            group={group}
            onGroup={setGroup}
            next={next(s.pm25 ?? 30, s.hour ?? 14)}
          />
        </div>
      ))}
    </main>
  );
}
