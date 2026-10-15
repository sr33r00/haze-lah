"use client";

import Link from "next/link";
import { TONE_COLOR, verdict } from "@/lib/bands";
import { fmtTime } from "@/lib/format";
import { currentReading } from "@/lib/situation";
import type { HazeData } from "@/lib/types";
import Freshness from "./Freshness";
import { cap } from "./ui";
import { usePrefs } from "./usePrefs";

/** Full-screen reading for a home-screen shortcut or a wall display. */
export default function GlanceView({ data }: { data: HazeData }) {
  const { region, group } = usePrefs();
  const { latest, psi, level } = currentReading(data, region);
  const tone = level != null ? TONE_COLOR[verdict(level, group).tone] : null;

  return (
    <main
      className="flex min-h-dvh flex-col justify-between px-6 py-5"
      style={tone ? { background: tone.bg, color: tone.fg } : { background: "var(--surface)", color: "var(--fg)" }}
    >
      <Link href="/" className="text-[15px] font-extrabold tracking-tight">
        Haze Lah
      </Link>
      <div>
        <p className="text-[17px] opacity-80">{cap(region)}, PM2.5 now</p>
        <p className="tabular text-[clamp(7rem,38vw,16rem)] font-light leading-none tracking-tight">{latest ? Math.round(latest.value) : "–"}</p>
        <h1 className="mt-4 text-[clamp(2.5rem,9vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
          {level != null ? verdict(level, group).headline : "No reading yet."}
        </h1>
        <p className="tabular mt-3 text-[clamp(1.25rem,4vw,2rem)] opacity-80">PSI {psi ?? "–"}, 24-hour</p>
      </div>
      <p className="text-[15px] opacity-80">
        {latest ? `NEA reading at ${fmtTime(latest.time)}` : "Waiting for NEA"} · <Freshness generatedAt={data.generatedAt} />
      </p>
    </main>
  );
}
