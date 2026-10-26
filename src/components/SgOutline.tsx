"use client";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Pane, Polygon, useMap, useMapEvents } from "react-leaflet";
import outline from "@/lib/sgOutline.json";
import { SG_OUTLINE_NAME, SG_OUTLINE_URL } from "@/lib/links";

const PANE = "sg-outline";
// Above the basemap and the PM2.5 veil (250), under the map's paths, dots and markers (overlay pane 400, marker pane 600).
const Z = 300;

const CREDIT = `Outline: <a href="${SG_OUTLINE_URL}" target="_blank" rel="noreferrer">${SG_OUTLINE_NAME}</a> via data.gov.sg`;

type Ring = [number, number][];
/** Singapore's land (the main island and 22 islands) as Leaflet positions: [lat, lon] rings per polygon. */
const LAND: Ring[][] = outline.geometries[0].coordinates.map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number])));

/** Line weight in px: heavier on the smoke map's wide views, where Singapore is small, and 1.5 px once the island fills the map. */
const weight = (zoom: number) => Math.min(2.5, Math.max(1.5, 3.2 - zoom * 0.18));

/**
 * Singapore's border as a line over the basemap: a halo in the page's surface colour under a stroke in its text colour (both follow the
 * theme through the `.sg-outline-*` rules in globals.css, which an SVG layer can use and a canvas one cannot). No fill, not interactive.
 * It has its own pane, so it sits above the PM2.5 veil and below the map's markers and dots.
 */
export default function SgOutline() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const renderer = useMemo(() => L.svg({ pane: PANE }), []);
  // A path layer's own `attribution` option is not picked up by the map's credit line, so it is added by hand.
  useEffect(() => {
    map.attributionControl?.addAttribution(CREDIT);
    return () => void map.attributionControl?.removeAttribution(CREDIT);
  }, [map]);
  const w = weight(zoom);
  const base = { renderer, interactive: false, fill: false, lineJoin: "round", lineCap: "round" } as const;
  return (
    <Pane name={PANE} style={{ zIndex: Z }}>
      <Polygon positions={LAND} pathOptions={{ ...base, className: "sg-outline-halo", color: "#fff", weight: w + 2.5, opacity: 0.6 }} />
      <Polygon positions={LAND} pathOptions={{ ...base, className: "sg-outline-line", color: "#d4113c", weight: w, opacity: 0.9 }} />
    </Pane>
  );
}
