"use client";

import type { Map as LeafletMap } from "leaflet";
import { useMemo } from "react";
import { useMap } from "react-leaflet";
import { windOf, type WindView } from "@/lib/windParticles";
import { useWindParticles } from "./useWindParticles";

/** Leaflet's map as the wind animation sees it. */
function leafletView(map: LeafletMap): WindView {
  return {
    container: map.getContainer(),
    zIndex: 450,
    size: () => {
      const s = map.getSize();
      return { w: s.x, h: s.y };
    },
    project: (lat, lon) => map.latLngToContainerPoint([lat, lon]),
    bounds: () => {
      const b = map.getBounds();
      return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    },
    pxPerDeg: () => (256 * 2 ** map.getZoom()) / 360,
    listen: ({ moved, settled, resized }) => {
      map.on("move zoom", moved);
      map.on("moveend", settled);
      map.on("resize", resized);
      return () => {
        map.off("move zoom", moved);
        map.off("moveend", settled);
        map.off("resize", resized);
      };
    },
  };
}

/**
 * Animated wind particles over the map (u and v in m/s on a lat/lon grid). Under reduced motion it draws still arrows,
 * unless `motion` says the viewer asked for the animation anyway.
 */
export default function WindLayer({ lats, lons, u, v, motion = false }: { lats: number[]; lons: number[]; u: number[]; v: number[]; motion?: boolean }) {
  const map = useMap();
  const wind = useMemo(() => windOf(lats, lons, u, v), [lats, lons, u, v]);
  const view = useMemo(() => leafletView(map), [map]);
  useWindParticles(view, wind, motion);
  return null;
}
