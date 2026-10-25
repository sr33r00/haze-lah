"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Marker, Pane, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { FIRE_COLOR, NEW_FIRE_COLOR, TRAIL_COLOR } from "@/lib/replay";
import { bandColor, type Dot } from "@/lib/readings";
import type { SmokeGrid } from "@/lib/types";
import { SG } from "@/lib/util";
import { drawField, fieldCorners } from "./globe/fieldImage";
import WindLayer from "./WindLayer";

/**
 * The first view: the old smoke map's frame (Singapore, 6.5° north and south) moved 2.5° south so that Java's north coast shows,
 * 8.5° of longitude west of Singapore and 12.2° east, to reach the fires of Kalimantan. FitPath widens it for the path.
 */
const START: [[number, number], [number, number]] = [
  [SG.lat - 9, SG.lon - 8.5],
  [SG.lat + 4, SG.lon + 12.2],
];

type Pt = [number, number];

/** What the map draws for one step of the slider. */
export type OriginLayers = {
  /** The PM2.5 of the step on its grid, drawn as the veil. */
  model: { grid: Pick<SmokeGrid, "lats" | "lons">; values: number[] } | null;
  wind: { lats: number[]; lons: number[]; u: number[]; v: number[] } | null;
  motion: boolean;
  /** The air's path to Singapore, newest point first. */
  trail: Pt[];
  /** A dot and a weekday label at 24 h intervals along the path. */
  marks: { at: Pt; label: string }[];
  fires: readonly (readonly number[])[];
  /** Fires of a day other than the one shown are dimmed. */
  firesDim: boolean;
  /** Centres of the new fire zones. */
  fresh: Pt[];
  /** Where smoke from today's fires goes next. */
  ahead: Pt[];
  dots: Dot[];
  spot: Pt | null;
};

/** Reports where the map is clicked. */
function Tap({ onTap }: { onTap: (at: Pt) => void }) {
  useMapEvents({ click: (e) => onTap([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Once the air's path is known, widens the first view to take in the whole path (its start included) and never zooms out past START. */
function FitPath({ trail }: { trail: Pt[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || trail.length < 2) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(START).extend(L.latLngBounds(trail)), { padding: [8, 8], animate: false });
  }, [map, trail]);
  return null;
}

/** The weekday label of a mark on the path: a white dot ringed in the path's colour. */
const markIcon = (label: string) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white" style="border-color:${TRAIL_COLOR}"></span><span class="absolute left-2 top-0 -translate-y-1/2 whitespace-nowrap text-fine font-bold text-white [text-shadow:0_0_3px_#000,0_1px_2px_#000]">${label}</span>`,
  });

/** The PM2.5 veil as a Web Mercator picture of the grid's box, which Leaflet's image overlay places exactly. */
function useVeil(model: OriginLayers["model"]) {
  const [url, setUrl] = useState<string | null>(null);
  // Drawn once per frame at most, so that dragging the slider stays smooth.
  useEffect(() => {
    if (!model) return setUrl(null);
    const id = requestAnimationFrame(() => setUrl(drawField(model.grid, model.values, "pm25").toDataURL()));
    return () => cancelAnimationFrame(id);
  }, [model]);
  const bounds = useMemo(() => {
    if (!model) return null;
    const [[w, n], , [e, s]] = fieldCorners(model.grid);
    return [[s, w], [n, e]] as [Pt, Pt];
  }, [model]);
  return url && bounds ? { url, bounds } : null;
}

/**
 * The Now page's smoke map: a zoomable OpenStreetMap basemap (muted in the page's theme by globals.css) with the PM2.5 veil,
 * fires, the air's path, wind and the reading dots over it. One Leaflet map, loaded lazily by HazeOrigin.
 */
export default function OriginMap({ layers, onTap }: { layers: OriginLayers; onTap: (at: Pt) => void }) {
  const { model, wind, motion, trail, marks, fires, firesDim, fresh, ahead, dots, spot } = layers;
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []); // one finger scrolls the page; two zoom the map
  const veil = useVeil(model);
  const fire = { color: FIRE_COLOR, weight: 0, fillOpacity: firesDim ? 0.4 : 0.85 };
  return (
    <MapContainer
      bounds={START}
      zoomSnap={0.5}
      minZoom={4}
      maxZoom={9}
      scrollWheelZoom={false}
      dragging={!touch}
      keyboard={false} // arrow keys move the reading spot, see HazeOrigin
      preferCanvas
      className="origin-map h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {veil && (
        // Between the basemap and everything else, so the path, fires and wind stay clear of it
        <Pane name="veil" style={{ zIndex: 250 }}>
          <ImageOverlay url={veil.url} bounds={veil.bounds} interactive={false} pane="veil" />
        </Pane>
      )}
      {ahead.length > 1 && (
        <>
          <Polyline positions={ahead} interactive={false} pathOptions={{ color: "#fff", weight: 6, opacity: 0.55, lineCap: "round" }} />
          <Polyline positions={ahead} interactive={false} pathOptions={{ color: FIRE_COLOR, weight: 3, dashArray: "7 7", lineCap: "round" }} />
        </>
      )}
      {trail.length > 1 && (
        <>
          <Polyline positions={trail} interactive={false} pathOptions={{ color: TRAIL_COLOR, weight: 18, opacity: 0.3, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={trail} interactive={false} pathOptions={{ color: TRAIL_COLOR, weight: 2.5, opacity: 0.95, lineJoin: "round" }} />
        </>
      )}
      {fires.map((p, i) => (
        <CircleMarker key={i} center={[p[0], p[1]]} radius={2.5} interactive={false} pathOptions={fire} />
      ))}
      {fresh.map((p, i) => (
        <Fragment key={i}>
          <CircleMarker center={p} radius={13} interactive={false} pathOptions={{ color: "#000", weight: 3.5, opacity: 0.4, fill: false }} />
          <CircleMarker center={p} radius={13} interactive={false} pathOptions={{ color: NEW_FIRE_COLOR, weight: 1.5, fill: false }} />
        </Fragment>
      ))}
      {dots.map((d, i) => (
        <CircleMarker
          key={i}
          center={[d.lat, d.lon]}
          radius={d.rank === 2 ? 4 : 6}
          // A white outline, so that a Normal reading (the faintest colour) still shows on the map
          pathOptions={{ color: "#fff", weight: d.rank === 2 ? 1.25 : 1.5, fillColor: d.color ?? bandColor(d.band), fillOpacity: d.kind === "model" ? 0.5 : 1 }}
        >
          <Tooltip>
            {d.label}: {d.value}
            {d.kind === "model" ? " (model)" : ""}
          </Tooltip>
        </CircleMarker>
      ))}
      {marks.map((m, i) => (
        <Marker key={i} position={m.at} icon={markIcon(m.label)} interactive={false} keyboard={false} />
      ))}
      <FitPath trail={trail} />
      <Tap onTap={onTap} />
      {spot && <CircleMarker center={spot} radius={7} interactive={false} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />}
      {wind && <WindLayer {...wind} motion={motion} />}
    </MapContainer>
  );
}
