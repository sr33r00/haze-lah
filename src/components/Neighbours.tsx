"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LEVEL_TEXT, stationLevel } from "@/lib/bands";
import type { HazeData } from "@/lib/types";
import { Card } from "./ui";

const HazeMap = dynamic(() => import("./HazeMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-line" />,
});

const NEARBY_KM = 260;

export default function Neighbours({ data }: { data: HazeData }) {
  const [showMap, setShowMap] = useState(false);
  const list = data.stations.filter((s) => s.country === "ID" || s.distanceKm < NEARBY_KM).slice(0, 14);
  if (!list.length) return null;
  return (
    <Card
      title="Neighbours"
      aside={
        <button onClick={() => setShowMap((s) => !s)} className="text-sm font-medium text-sky-600">
          {showMap ? "Hide map" : "Show map"}
        </button>
      }
    >
      {showMap && (
        <div className="mb-3">
          <HazeMap data={data} />
        </div>
      )}
      <ul className="divide-y divide-line">
        {list.map((s) => {
          const lv = stationLevel(s);
          return (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">
                  {s.country === "MY" ? "🇲🇾" : "🇮🇩"} {s.name}
                </div>
                <div className="text-xs text-muted">
                  {s.state} · {s.distanceKm} km{s.country === "ID" ? " · model estimate" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-lg font-bold" style={{ color: lv != null ? LEVEL_TEXT[lv] : undefined }}>
                  {s.api ?? s.pm25 ?? "–"}
                </div>
                <div className="text-[10px] text-muted">{s.api != null ? "API" : "PM2.5 µg/m³"}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Malaysia&apos;s API uses the same bands as Singapore&apos;s PSI. Indonesian cities have no open live feed, so these are Copernicus
        model estimates.
      </p>
    </Card>
  );
}
