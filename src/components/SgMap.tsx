"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import { LEVEL_COLOR, REGIONS, REGION_POINT, pm25Color, stationLevel, type Region } from "@/lib/bands";
import { cap } from "@/lib/format";
import type { NeaPm25History, Sensor, Station } from "@/lib/types";

const BOUNDS: L.LatLngBoundsExpression = [
  [1.205, 103.6],
  [1.52, 104.05],
];
const MAX_SENSOR_AGE_MS = 3 * 3600_000;

function pill(value: number | null, active: boolean) {
  const bg = value == null ? "#8a8f98" : pm25Color(value);
  const ring = active ? "box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--fg);" : "";
  return L.divIcon({
    className: "",
    iconSize: [40, 24],
    iconAnchor: [20, 12],
    html: `<div style="width:40px;height:24px;border-radius:12px;background:${bg};color:#fff;font:700 13px/24px var(--font-sans);text-align:center;${ring}">${value ?? "–"}</div>`,
  });
}

/** Singapore at a glance: NEA regional PM2.5, community sensors and nearby Malaysian stations. */
export default function SgMap(props: { history: NeaPm25History | null; region: Region; onPick: (r: Region) => void; sensors: Sensor[]; stations: Station[] }) {
  const { history, region, onPick } = props;
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  const fresh = useMemo(() => props.sensors.filter((s) => Date.now() - new Date(s.time).getTime() < MAX_SENSOR_AGE_MS), [props.sensors]);
  const nearMy = useMemo(() => props.stations.filter((s) => s.country === "MY" && s.distanceKm < 60), [props.stations]);

  return (
    <div className="px-4">
      <div className="h-[300px] overflow-hidden rounded-3xl">
        <MapContainer bounds={BOUNDS} minZoom={10} maxZoom={14} scrollWheelZoom={false} dragging={!touch} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {nearMy.map((s) => (
            <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={6} pathOptions={{ color: "#fff", weight: 1.5, fillColor: LEVEL_COLOR[stationLevel(s) ?? 0], fillOpacity: 0.9 }}>
              <Tooltip>{`${s.name}: API ${s.api ?? "n/a"} (Malaysia)`}</Tooltip>
            </CircleMarker>
          ))}
          {fresh.map((s) => (
            <CircleMarker key={`${s.name}${s.lat}${s.lon}`} center={[s.lat, s.lon]} radius={5} pathOptions={{ color: "#fff", weight: 1, fillColor: pm25Color(s.pm25), fillOpacity: 0.9 }}>
              <Tooltip>{`${s.name}: PM2.5 ${s.pm25} µg/m³ (community sensor)`}</Tooltip>
            </CircleMarker>
          ))}
          {REGIONS.map((r) => {
            const v = history?.regions[r].at(-1)?.value;
            const n = v == null ? null : Math.round(v);
            return (
              <Marker
                key={r}
                position={REGION_POINT[r]}
                icon={pill(n, r === region)}
                title={`${cap(r)}, PM2.5 ${n ?? "n/a"}`}
                zIndexOffset={r === region ? 1000 : 500}
                eventHandlers={{ click: () => onPick(r) }}
              />
            );
          })}
        </MapContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-[#d9a118]" />
          NEA 1-hr PM2.5
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#d9a118]" />
          Community sensors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#d9a118]" />
          Malaysia API
        </span>
      </div>
    </div>
  );
}
