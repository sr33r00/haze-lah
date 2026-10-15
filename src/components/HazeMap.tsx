"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { LEVEL_COLOR, psiLevel, pm25ToLevel } from "@/lib/bands";
import type { HazeData } from "@/lib/types";

const SG_POINTS: Record<string, [number, number]> = {
  north: [1.418, 103.82],
  south: [1.296, 103.82],
  east: [1.352, 103.94],
  west: [1.352, 103.7],
  central: [1.357, 103.82],
};

export default function HazeMap({ data }: { data: HazeData }) {
  return (
    <div className="h-80 overflow-hidden rounded-2xl">
      <MapContainer center={[0.6, 105]} zoom={5} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {data.fires.points.map((f, i) => (
          <CircleMarker
            key={i}
            center={[f.lat, f.lon]}
            radius={Math.min(2 + f.frp / 25, 6)}
            pathOptions={{ color: "#f97316", weight: 0, fillOpacity: 0.7 }}
          />
        ))}
        {data.stations.map((s) => {
          const lv = s.api != null ? psiLevel(s.api) : s.pm25 != null ? pm25ToLevel(s.pm25) : null;
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lon]}
              radius={7}
              pathOptions={{ color: "#fff", weight: 1.5, fillColor: lv != null ? LEVEL_COLOR[lv] : "#9ca3af", fillOpacity: 0.95 }}
            >
              <Tooltip>
                {s.name}: {s.api != null ? `API ${s.api}` : `PM2.5 ${s.pm25 ?? "–"} (model)`}
              </Tooltip>
            </CircleMarker>
          );
        })}
        {data.nea &&
          Object.entries(SG_POINTS).map(([r, c]) => {
            const p = data.nea!.psi24[r as keyof typeof data.nea.psi24];
            return (
              <CircleMarker
                key={r}
                center={c}
                radius={6}
                pathOptions={{ color: "#111", weight: 1.5, fillColor: isNaN(p) ? "#9ca3af" : LEVEL_COLOR[psiLevel(p)], fillOpacity: 1 }}
              >
                <Tooltip>
                  Singapore {r}: PSI {p}
                </Tooltip>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
