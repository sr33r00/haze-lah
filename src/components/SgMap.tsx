"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { LEVEL_COLOR, LEVEL_NAME, LEVEL_TEXT, PM25_BANDS, PM25_COLORS, REGIONS, REGION_POINT, US_AQI_BANDS, nearestRegion, pm25Color, pm25ToUsAqi, psiLevel, stationLevel, textOn, usAqiColor, type Region } from "@/lib/bands";
import { cap, fmtTime } from "@/lib/format";
import { US_AQI_NOTE, WAQI_NAME, WAQI_URL } from "@/lib/links";
import type { AqiStation, Camera, NeaNow, NeaPm25History, Sensor, Station } from "@/lib/types";
import { MAX_SENSOR_AGE_MS, haversineKm } from "@/lib/util";
import RampBar from "./RampBar";
import { Segmented } from "./ui";
import { locateMe, useMyPosition } from "./useMyPosition";
import { useStored } from "./usePrefs";

const BOUNDS: L.LatLngBoundsExpression = [
  [1.205, 103.6],
  [1.52, 104.05],
];
const SENSOR_KM = 3; // a community sensor this close is worth showing next to the regional reading

type Spot = { lat: number; lon: number; mine: boolean };

/** What the map's numbers are: NEA's PM2.5 (µg/m³) or the US AQI AQICN shows. */
type Unit = "pm25" | "aqi";
const UNITS: readonly Unit[] = ["pm25", "aqi"];
const UNIT_OPTIONS = [
  { id: "pm25", label: "PM2.5" },
  { id: "aqi", label: "US AQI" },
] as const;

/** A band scale as hard-stop colour steps of equal width, with the ranges it covers and what each means. */
function scale(colors: readonly string[], names: string[], meanings: string[]) {
  const n = colors.length;
  return { names, meanings, background: `linear-gradient(to right, ${colors.map((c, i) => `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`).join(", ")})` };
}
const range = (from: number, max: number) => (max === Infinity ? `${from}+` : `${from}–${max}`);
const PM25_SCALE = {
  ...scale(
    PM25_COLORS,
    PM25_BANDS.map((b, i) => (i === 0 ? `≤${b.max}` : range(PM25_BANDS[i - 1].max + 1, b.max))),
    PM25_BANDS.map((b) => b.name),
  ),
  label: `NEA 1-hour PM2.5 in µg/m³: ${PM25_BANDS.map((b, i) => `${b.name} ${i === 0 ? "up to" : "above"} ${i === 0 ? b.max : PM25_BANDS[i - 1].max}`).join(", ")}`,
};
const AQI_SCALE = {
  ...scale(
    US_AQI_BANDS.map((b) => b.color),
    US_AQI_BANDS.map((b) => range(b.from, b.max)),
    US_AQI_BANDS.map((b) => ("short" in b ? b.short : b.name)),
  ),
  label: `US AQI: ${US_AQI_BANDS.map((b) => `${b.name} ${range(b.from, b.max)}`).join(", ")}`,
};

// lucide "camera" glyph, so the marker matches the app's icons.
const CAMERA_ICON = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="width:24px;height:24px;border-radius:7px;background:#13232e;display:grid;place-items:center;box-shadow:0 0 0 1.5px #fff"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></div>`,
});

/** The four kinds of number badge, biggest first. `z` stacks them (Leaflet adds it to the marker's own latitude-based order). */
const BADGE = {
  nea: { h: 24, minW: 40, font: 13, border: 0, radius: 12, z: 40000 },
  aqicn: { h: 26, minW: 26, font: 12, border: 2, radius: 13, z: 20000 },
  my: { h: 22, minW: 22, font: 11, border: 2, radius: 6, z: 10000 },
  sensor: { h: 20, minW: 20, font: 11, border: 1, radius: 10, z: 0 },
} as const;
type BadgeKind = keyof typeof BADGE;
const ME_Z = 30000; // "you are here": above the sensors, below the NEA pills

const badges = new Map<string, L.DivIcon>();

/** A number in a coloured badge. Built once per look, so re-renders reuse the icons. */
function badge(kind: BadgeKind, value: number | null, color: string, active = false) {
  const key = `${kind}|${value}|${color}|${active}`;
  let icon = badges.get(key);
  if (!icon) {
    const b = BADGE[kind];
    const label = value ?? "–";
    const w = Math.max(b.minW, Math.ceil(String(label).length * b.font * 0.62) + 6);
    const edge = b.border ? `border:${b.border}px solid #fff;` : "";
    const bg = value == null ? "#8a8f98" : color;
    const fg = textOn(bg);
    const ring = active ? "0 0 0 2px var(--surface),0 0 0 4px var(--fg)" : b.border ? "0 0 0 1px rgba(0,0,0,.25)" : "none";
    icon = L.divIcon({
      className: "",
      iconSize: [w, b.h],
      iconAnchor: [w / 2, b.h / 2],
      tooltipAnchor: [0, -b.h / 2],
      html: `<div style="box-sizing:border-box;width:${w}px;height:${b.h}px;border-radius:${b.radius}px;background:${bg};color:${fg};${fg === "#fff" ? "text-shadow:0 0 2px rgb(0 0 0 / 0.55);" : ""}font:700 ${b.font}px/${b.h - 2 * b.border}px var(--font-sans);text-align:center;white-space:nowrap;${edge}box-shadow:${ring}">${label}</div>`,
    });
    badges.set(key, icon);
  }
  return icon;
}

// "You are here": a blue dot with a white ring and a soft halo.
const ME_ICON = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<div style="width:28px;height:28px;border-radius:50%;background:rgba(37,99,235,.22);display:grid;place-items:center"><div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-sizing:border-box;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div></div>`,
});

/** Map clicks pick a spot; a located spot is flown to. */
function SpotControl({ spot, onSpot }: { spot: Spot | null; onSpot: (s: Spot) => void }) {
  const map = useMap();
  useMapEvents({ click: (e) => onSpot({ lat: e.latlng.lat, lon: e.latlng.lng, mine: false }) });
  useEffect(() => {
    if (spot?.mine) map.setView([spot.lat, spot.lon], 13);
  }, [map, spot]);
  return null;
}

/** Singapore at a glance: NEA regional PM2.5, community sensors and nearby Malaysian stations; in the US AQI view the same on that scale, with AQICN's stations. Tap anywhere for that spot's readings. */
export default function SgMap(props: {
  history: NeaPm25History | null;
  psi24: NeaNow["psi24"] | null;
  region: Region;
  onPick: (r: Region) => void;
  sensors: Sensor[];
  aqiStations: AqiStation[];
  stations: Station[];
  cameras: Camera[];
}) {
  const { history, region, onPick } = props;
  const [unit, setUnit] = useStored<Unit>("mapUnit", UNITS, "pm25");
  const aqi = unit === "aqi";
  const [spot, setSpot] = useState<Spot | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const me = useMyPosition(true);
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  const fresh = useMemo(() => props.sensors.filter((s) => Date.now() - new Date(s.time).getTime() < MAX_SENSOR_AGE_MS), [props.sensors]);
  const freshAqi = useMemo(() => props.aqiStations.filter((s) => Date.now() - new Date(s.time).getTime() < MAX_SENSOR_AGE_MS), [props.aqiStations]);
  const nearMy = useMemo(() => props.stations.filter((s) => s.country === "MY" && s.distanceKm < 60), [props.stations]);

  const pickSpot = (p: Spot) => {
    setNote(null);
    setSpot(p);
    onPick(nearestRegion(p.lat, p.lon));
  };
  const locate = async () => {
    setNote("Finding you…");
    const r = await locateMe();
    if (r.status === "ok") pickSpot({ lat: r.lat, lon: r.lon, mine: true });
    else
      setNote(
        r.status === "unsupported"
          ? "Location is not available on this device."
          : r.status === "outside"
            ? "You seem to be outside Singapore. Tap the map instead."
            : "Could not get your location. Tap the map instead.",
      );
  };
  const tone = (n: number) => (aqi ? usAqiColor(n) : pm25Color(n));

  return (
    <div className="px-4">
      <Segmented label="Map shows" options={UNIT_OPTIONS} on={(id) => id === unit} onSelect={setUnit} className="mb-3" />
      <div className="relative isolate h-[300px] overflow-hidden rounded-3xl">
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
          {!aqi &&
            nearMy.map((s) => {
              const text = `${s.name}: API ${s.api ?? "n/a"} (Malaysia)`;
              return (
                <Marker key={s.id} position={[s.lat, s.lon]} icon={badge("my", s.api, LEVEL_COLOR[stationLevel(s) ?? 0])} title={text} zIndexOffset={BADGE.my.z}>
                  <Tooltip direction="top">{text}</Tooltip>
                </Marker>
              );
            })}
          {aqi &&
            freshAqi.map((s) => {
              const text = `${s.name}: US AQI ${s.aqi} (AQICN, ${fmtTime(s.time)})`;
              const t = tone(s.aqi);
              return (
                <Marker key={s.uid} position={[s.lat, s.lon]} icon={badge("aqicn", s.aqi, t)} title={text} zIndexOffset={BADGE.aqicn.z}>
                  <Tooltip direction="top">{text}</Tooltip>
                </Marker>
              );
            })}
          {fresh.map((s) => {
            const n = aqi ? pm25ToUsAqi(s.pm25) : s.pm25;
            const text = aqi ? `${s.name}: US AQI ${n} (community sensor)` : `${s.name}: PM2.5 ${n} µg/m³ (community sensor)`;
            const t = tone(n);
            return (
              <Marker key={`${s.name}${s.lat}${s.lon}`} position={[s.lat, s.lon]} icon={badge("sensor", Math.round(n), t)} title={text} keyboard={false} zIndexOffset={BADGE.sensor.z}>
                <Tooltip direction="top">{text}</Tooltip>
              </Marker>
            );
          })}
          {props.cameras.map((c) => (
            <Marker
              key={c.id}
              position={[c.lat, c.lon]}
              icon={CAMERA_ICON}
              title={`Camera: ${c.name}`}
              eventHandlers={{ click: () => (location.href = `/photos?cam=${c.id}#ground`) }}
            />
          ))}
          <SpotControl spot={spot} onSpot={pickSpot} />
          {spot && !spot.mine && (
            <CircleMarker
              center={[spot.lat, spot.lon]}
              radius={6}
              pathOptions={{ color: "#13232e", weight: 3, fillColor: "#fff", fillOpacity: 1 }}
              interactive={false}
            />
          )}
          {me && <Marker position={[me.lat, me.lon]} icon={ME_ICON} interactive={false} keyboard={false} zIndexOffset={ME_Z} />}
          {REGIONS.map((r) => {
            const v = history?.regions[r].at(-1)?.value;
            const n = v == null ? null : aqi ? pm25ToUsAqi(v) : Math.round(v);
            return (
              <Marker
                key={r}
                position={REGION_POINT[r]}
                icon={n == null ? badge("nea", null, "", r === region) : badge("nea", n, tone(n), r === region)}
                title={`${cap(r)}, ${aqi ? "US AQI" : "PM2.5"} ${n ?? "n/a"}`}
                zIndexOffset={BADGE.nea.z + (r === region ? 10000 : 0)}
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
      <div className="mt-3 space-y-2 text-[12px] text-muted">
        <LegendRow>
          <Key swatch={<span className={`h-2.5 w-4 rounded-full ${aqi ? "bg-muted" : "bg-[#d9a118]"}`} />}>NEA regions</Key>
          <Key swatch={<span className={`h-2.5 w-2.5 rounded-full border border-white ring-1 ring-black/20 ${aqi ? "bg-muted" : "bg-[#d9a118]"}`} />}>Sensors</Key>
          {aqi && freshAqi.length > 0 && <Key swatch={<span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-muted ring-1 ring-black/20" />}>AQICN</Key>}
          {!aqi && <Key swatch={<span className="h-3 w-3 rounded-[3px] border-2 border-white bg-[#d9a118] ring-1 ring-black/20" />}>Malaysia API</Key>}
          {props.cameras.length > 0 && <Key swatch={<span className="h-2.5 w-2.5 rounded-[3px] bg-[#13232e] ring-1 ring-white" />}>Cameras</Key>}
          {/* Hidden, not removed, until the position is known, so the legend never changes height. */}
          <span className={me ? "" : "invisible"}>
            <Key swatch={<span className="h-3 w-3 rounded-full border-2 border-white bg-[#2563eb] ring-1 ring-black/20" />}>You</Key>
          </span>
        </LegendRow>
        <div className="pb-0.5">
          <RampBar {...(aqi ? AQI_SCALE : PM25_SCALE)} bar="border-line" text="text-muted" />
        </div>
        {/* Both captions share one grid cell, so the legend is as tall in either view; the other one is only hidden. */}
        <div className="grid">
          <div className={`[grid-area:1/1] ${aqi ? "invisible" : ""}`}>
            <p>NEA 1-hr PM2.5, µg/m³.</p>
          </div>
          <div className={`space-y-1 [grid-area:1/1] ${aqi ? "" : "invisible"}`}>
            <p>{US_AQI_NOTE}</p>
            <p className={freshAqi.length > 0 ? "" : "invisible"}>
              AQI stations: {WAQI_NAME} (
              <a href={WAQI_URL} target="_blank" rel="noreferrer" className="underline">
                waqi.info
              </a>
              ) and the originating agencies. Not fully verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1.5">{children}</div>;
}

function Key({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
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
