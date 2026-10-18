"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { LEVEL_COLOR, LEVEL_NAME, LEVEL_TEXT, REGIONS, REGION_POINT, nearestRegion, pm25Color, psiLevel, stationLevel, type Region } from "@/lib/bands";
import { cap } from "@/lib/format";
import type { NeaNow, NeaPm25History, Sensor, Station } from "@/lib/types";
import { SG, haversineKm } from "@/lib/util";

const BOUNDS: L.LatLngBoundsExpression = [
  [1.205, 103.6],
  [1.52, 104.05],
];
const MAX_SENSOR_AGE_MS = 3 * 3600_000;
const SENSOR_KM = 3; // a community sensor this close is worth showing next to the regional reading

type Spot = { lat: number; lon: number; mine: boolean };

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

/** Map clicks pick a spot; a located spot is flown to. */
function SpotControl({ spot, onSpot }: { spot: Spot | null; onSpot: (s: Spot) => void }) {
  const map = useMap();
  useMapEvents({ click: (e) => onSpot({ lat: e.latlng.lat, lon: e.latlng.lng, mine: false }) });
  useEffect(() => {
    if (spot?.mine) map.setView([spot.lat, spot.lon], 13);
  }, [map, spot]);
  return null;
}

/** Singapore at a glance: NEA regional PM2.5, community sensors and nearby Malaysian stations. Tap anywhere for that spot's readings. */
export default function SgMap(props: {
  history: NeaPm25History | null;
  psi24: NeaNow["psi24"] | null;
  region: Region;
  onPick: (r: Region) => void;
  sensors: Sensor[];
  stations: Station[];
}) {
  const { history, region, onPick } = props;
  const [spot, setSpot] = useState<Spot | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  const fresh = useMemo(() => props.sensors.filter((s) => Date.now() - new Date(s.time).getTime() < MAX_SENSOR_AGE_MS), [props.sensors]);
  const nearMy = useMemo(() => props.stations.filter((s) => s.country === "MY" && s.distanceKm < 60), [props.stations]);

  const pickSpot = (p: Spot) => {
    setNote(null);
    setSpot(p);
    onPick(nearestRegion(p.lat, p.lon));
  };
  const locate = () => {
    if (!navigator.geolocation) return setNote("Location is not available on this device.");
    setNote("Finding you…");
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) =>
        Math.abs(c.latitude - SG.lat) < 0.3 && Math.abs(c.longitude - SG.lon) < 0.4
          ? pickSpot({ lat: c.latitude, lon: c.longitude, mine: true })
          : setNote("You seem to be outside Singapore. Tap the map instead."),
      () => setNote("Could not get your location. Tap the map instead."),
      { timeout: 8000, maximumAge: 600_000 },
    );
  };

  return (
    <div className="px-4">
      <div className="relative h-[300px] overflow-hidden rounded-3xl">
        <button
          onClick={locate}
          className="absolute right-3 top-3 z-[500] flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold shadow"
        >
          <LocateFixed size={16} aria-hidden />
          My location
        </button>
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
          <SpotControl spot={spot} onSpot={pickSpot} />
          {spot && (
            <CircleMarker
              center={[spot.lat, spot.lon]}
              radius={8}
              pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
              interactive={false}
            />
          )}
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
      <div aria-live="polite">
        {note && <p className="mt-3 text-[14px] text-muted">{note}</p>}
        {spot && !note && <SpotCard spot={spot} psi24={props.psi24} history={history} sensors={fresh} />}
      </div>
      {!spot && !note && <p className="mt-3 text-[14px] text-muted">Tap the map or use your location to see the reading there.</p>}
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

/** Readings for a picked spot: its NEA region's PSI and PM2.5, and the nearest community sensor if close. */
function SpotCard({ spot, psi24, history, sensors }: { spot: Spot; psi24: NeaNow["psi24"] | null; history: NeaPm25History | null; sensors: Sensor[] }) {
  const r = nearestRegion(spot.lat, spot.lon);
  const psi = psi24?.[r];
  const pm = history?.regions[r].at(-1)?.value;
  const near = sensors
    .map((s) => ({ s, km: haversineKm(spot.lat, spot.lon, s.lat, s.lon) }))
    .filter((x) => x.km < SENSOR_KM)
    .sort((a, b) => a.km - b.km)[0];
  const lv = psi != null && !isNaN(psi) ? psiLevel(psi) : null;
  return (
    <div className="mt-3 rounded-2xl bg-surface p-3">
      <p className="text-[13px] text-muted">{spot.mine ? `You are in the ${cap(r)} region` : `${cap(r)} region`}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="tabular text-[28px] font-bold leading-none">{lv != null ? psi : "–"}</span>
        <span className="text-[15px] font-semibold">
          24-hr PSI{lv != null && <span style={{ color: LEVEL_TEXT[lv] }}>, {LEVEL_NAME[lv]}</span>}
        </span>
      </p>
      <p className="mt-1.5 text-[14px] text-muted">
        1-hr PM2.5 {pm != null ? Math.round(pm) : "–"} µg/m³ from NEA.
        {near && ` Nearest sensor, ${near.s.name}, ${near.km < 1 ? `${Math.round(near.km * 1000)} m` : `${near.km.toFixed(1)} km`} away: ${near.s.pm25} µg/m³.`}
      </p>
      <p className="mt-1.5 text-[12px] text-muted">NEA publishes PSI for five regions, so this is the reading for your region.</p>
    </div>
  );
}
