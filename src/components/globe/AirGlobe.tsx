"use client";

import { LngLatBounds, Map as MapLibre, setWorkerUrl, type CanvasSource, type ExpressionSpecification, type GeoJSONSource, type PaddingOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { SMOKE_TILE_ZOOM, WORLD_CORNERS, globeDates, globePicture, smokeTiles } from "@/lib/globe";
import { FONT } from "@/lib/basemap";
import { SG } from "@/lib/util";
import type { WindView } from "@/lib/windParticles";
import { globeView } from "@/components/globeWind";
import { useWindParticles } from "@/components/useWindParticles";
import WindMotionButton, { useWindMotion } from "@/components/WindMotion";
import { drawField, fieldCorners } from "./fieldImage";
import { flowOf, frameGeo, type GlobeDay, type LayerChoice } from "./frame";
import { INK, globeStyle } from "./globeStyle";
import { SMOKE_SCHEME, registerSmokeScheme } from "./smokeTiles";

// MapLibre's worker is a file of its own; the bundler puts it among the static files and this is its address.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
registerSmokeScheme();

type Props = {
  day: GlobeDay;
  layer: LayerChoice;
  /** The date of the satellite picture shown when `layer` is "smoke". */
  satDate: string;
  /** "default" is the tilted view of the region; "path" frames the air's path. */
  view: "default" | "path";
  /** Called once when the globe cannot run: no WebGL, a lost WebGL context, or a basemap that will not load. */
  onFail?: () => void;
};

const CENTER: [number, number] = [108.5, -1]; // between Sumatra and Borneo
const SPAN_X = 29; // degrees across the screen's width
const SPAN_Y = 20;
/** Under this width (px) the screen is a phone: closer in, less tilt, room kept for the card at the bottom. */
const NARROW = 700;
/** Where the default camera ends up: tipped so that the globe's edge and its atmosphere show. */
function homeCamera(w: number, h: number) {
  const narrow = w < NARROW;
  const fit = Math.log2(Math.min(w / SPAN_X, h / SPAN_Y) * (360 / 512));
  return { zoom: fit + (narrow ? 0.4 : -0.3), pitch: narrow ? 40 : 48, center: CENTER, padding: { top: 0, left: 0, right: 0, bottom: narrow ? 90 : 0 } as PaddingOptions };
}
const INTRO_MS = 2800;
const MOVE_MS = 1400;
const ease = (t: number) => 1 - (1 - t) ** 3;
const z = (...stops: (number | string)[]) => ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;

/** The first line layer: the pollution pictures go under the coast and border lines. */
const FIRST = "o_coast";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const PLACES: [string, number, number][] = [
  ["THAILAND", 15.3, 101],
  ["VIETNAM", 14.2, 108.3],
  ["PHILIPPINES", 12.5, 122.5],
  ["SULAWESI", -2, 121],
  ["SUMATRA", -0.2, 101.6],
  ["BORNEO", 0.9, 114.2],
  ["JAVA", -7.4, 110.4],
  ["MALAY PENINSULA", 4.3, 102.3],
  ["SOUTH CHINA SEA", 9.2, 112],
  ["JAVA SEA", -5.2, 111.6],
];

/** The layers that go over the basemap, with no data yet: fires, the air's path, names and Singapore. */
function addOverlays(m: MapLibre) {
  // Fires: older days dim, the day a heat map that turns into glowing points.
  m.addSource("older", { type: "geojson", data: EMPTY });
  m.addSource("fires", { type: "geojson", data: EMPTY });
  m.addSource("fresh", { type: "geojson", data: EMPTY });
  m.addLayer({
    id: "old-heat", type: "heatmap", source: "older",
    paint: {
      "heatmap-radius": z(1, 4, 6, 12), "heatmap-intensity": z(1, 0.06, 6, 0.2),
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(120,50,10,0)", 0.4, "rgba(150,70,20,0.28)", 1, "rgba(190,110,50,0.5)"],
      "heatmap-opacity": z(4, 0.55, 6.5, 0),
    },
  });
  m.addLayer({ id: "old", type: "circle", source: "older", minzoom: 5.5, paint: { "circle-radius": 1.4, "circle-color": "#c98a52", "circle-opacity": z(5.5, 0, 6.5, 0.28) } });
  m.addLayer({
    id: "heat", type: "heatmap", source: "fires",
    paint: {
      "heatmap-radius": z(1, 3, 4, 6, 6, 14),
      "heatmap-intensity": z(1, 0.18, 6, 0.7),
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(200,20,10,0)", 0.15, "rgba(190,25,15,0.45)", 0.35, "rgba(235,50,20,0.75)", 0.6, "rgba(255,120,20,0.9)", 0.82, "rgba(255,190,30,0.97)", 1, "rgba(255,235,60,1)"],
      "heatmap-opacity": z(4, 0.95, 6.5, 0),
    },
  });
  m.addLayer({ id: "fire-glow", type: "circle", source: "fires", minzoom: 5, paint: { "circle-radius": z(5, 5, 9, 12), "circle-color": INK.fireGlow, "circle-blur": 1, "circle-opacity": z(5, 0, 6.5, 0.55) } });
  m.addLayer({ id: "fire-core", type: "circle", source: "fires", minzoom: 5, paint: { "circle-radius": z(5, 1.3, 9, 3), "circle-color": INK.fireCore, "circle-opacity": z(5, 0, 6.5, 1) } });
  m.addLayer({ id: "fresh", type: "circle", source: "fresh", paint: { "circle-radius": z(2, 4, 6, 8, 9, 13), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": INK.newZone, "circle-stroke-width": 0.9, "circle-stroke-opacity": 0.8 } });

  // The air's path: a soft purple glow, a line that fades with age, and small hour dots.
  m.addSource("trail", { type: "geojson", data: EMPTY, lineMetrics: true });
  m.addSource("hours", { type: "geojson", data: EMPTY });
  m.addSource("ahead", { type: "geojson", data: EMPTY });
  const fade = (peak: number) => ["interpolate", ["linear"], ["line-progress"], 0, `rgba(196,140,255,${peak})`, 1, `rgba(150,70,240,${peak * 0.18})`] as ExpressionSpecification;
  const cap = { "line-cap": "round", "line-join": "round" } as const;
  m.addLayer({ id: "trail-glow", type: "line", source: "trail", layout: cap, paint: { "line-gradient": fade(0.75), "line-blur": 4, "line-width": z(1, 9, 8, 18) } });
  m.addLayer({ id: "trail", type: "line", source: "trail", layout: cap, paint: { "line-gradient": fade(1), "line-width": z(1, 1.4, 8, 3) } });
  m.addLayer({ id: "ahead", type: "line", source: "ahead", layout: { "line-join": "round" }, paint: { "line-color": INK.ahead, "line-dasharray": [2, 2], "line-width": z(1, 1.4, 8, 2.6), "line-opacity": 0.9 } });
  m.addLayer({ id: "hours-label", type: "symbol", source: "hours", layout: { "text-font": FONT, "text-field": ["get", "label"], "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top" }, paint: { "text-color": "rgba(216,180,254,0.85)", "text-halo-color": "rgba(2,3,10,0.8)", "text-halo-width": 1.2 } });
  m.addLayer({ id: "hours", type: "circle", source: "hours", paint: { "circle-radius": 2.6, "circle-color": "#14091f", "circle-stroke-color": "#d8b4fe", "circle-stroke-width": 1.2 } });

  // A few quiet names, and Singapore.
  const text = { "text-font": FONT, "text-anchor": "center" } as const;
  m.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features: PLACES.map(([n, lat, lon]) => ({ type: "Feature", properties: { n }, geometry: { type: "Point", coordinates: [lon, lat] } })) } });
  m.addLayer({ id: "places", type: "symbol", source: "places", layout: { ...text, "text-field": ["get", "n"], "text-size": 9.5, "text-letter-spacing": 0.35 }, paint: { "text-color": "rgba(210,225,255,0.34)", "text-halo-color": "rgba(2,3,10,0.6)", "text-halo-width": 1 } });
  m.addSource("sg", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [SG.lon, SG.lat] } } });
  m.addLayer({ id: "sg-halo", type: "circle", source: "sg", paint: { "circle-radius": z(2, 9, 8, 22), "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "rgba(255,255,255,0.18)", "circle-stroke-width": 6, "circle-stroke-opacity": 0.6, "circle-blur": 0.8 } });
  m.addLayer({ id: "sg-ring", type: "circle", source: "sg", paint: { "circle-radius": z(2, 4.5, 8, 9), "circle-color": "rgba(0,0,0,0.25)", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
  m.addLayer({ id: "sg-label", type: "symbol", source: "sg", layout: { ...text, "text-field": "Singapore", "text-size": 12, "text-offset": [0, -1.5], "text-anchor": "bottom", "text-allow-overlap": true }, paint: { "text-color": "#fff", "text-halo-color": "rgba(2,3,10,0.85)", "text-halo-width": 1.4 } });
}

/** The satellite picture of `date`: the server's picture for the last few days, else NASA's tiles. Not drawn when `date` is null. */
function setSatellite(m: MapLibre, date: string | null) {
  if (m.getLayer("sat")) m.removeLayer("sat");
  if (m.getSource("sat")) m.removeSource("sat");
  if (!date) return;
  const frames = globeDates(Date.now());
  m.addSource(
    "sat",
    frames.includes(date)
      ? { type: "image", url: globePicture("smoke", date === frames[frames.length - 1] ? undefined : date), coordinates: WORLD_CORNERS }
      : { type: "raster", tiles: [`${SMOKE_SCHEME}://${smokeTiles(date)}`], tileSize: 256, maxzoom: SMOKE_TILE_ZOOM, attribution: "NASA GIBS" },
  );
  m.addLayer({ id: "sat", type: "raster", source: "sat", paint: { "raster-opacity": 0.45, "raster-saturation": -0.35, "raster-resampling": "linear", "raster-fade-duration": 0 } }, FIRST);
}

/** The camera that frames the air's path (Singapore to where the air came from), or null for a path too short to frame. */
function pathCamera(m: MapLibre, trail: GlobeDay["trail"], w: number) {
  if (trail.length < 2) return null;
  const narrow = w < NARROW;
  const bounds = trail.reduce((b, [lat, lon]) => b.extend([lon, lat]), new LngLatBounds([SG.lon, SG.lat], [SG.lon, SG.lat]));
  const padding: PaddingOptions = { top: 90, left: 40, right: 40, bottom: narrow ? 300 : 110 };
  const cam = m.cameraForBounds(bounds, { padding, maxZoom: 6 });
  return cam && { center: cam.center, zoom: cam.zoom, pitch: narrow ? 15 : 25, padding };
}

/**
 * The air globe: NASA night lights and relief, a pollutant's CAMS field or NASA's smoke picture, fires, wind and the air's path,
 * for the day it is given. Meant to fill its parent; the parent decides the size. Client only: load it through AirGlobeLoader.
 */
export default function AirGlobe({ day, layer, satDate, view, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>(undefined);
  const field = useRef<HTMLCanvasElement>(undefined);
  const intro = useRef(true);
  const failRef = useRef(onFail);
  const [ready, setReady] = useState(false);
  const [windView, setWindView] = useState<WindView>();
  const { reduced, motion, toggle } = useWindMotion();

  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    const el = box.current!;
    let live = true;
    let failed = false;
    const fail = () => {
      if (failed || !live) return;
      failed = true;
      failRef.current?.();
    };
    globeStyle().then((style) => {
      if (!live) return;
      const { clientWidth: w, clientHeight: h } = el;
      let m: MapLibre;
      try {
        m = new MapLibre({
          container: el,
          style,
          center: CENTER,
          zoom: Math.max(1.4, homeCamera(w, h).zoom - 1.6),
          pitch: 0,
          minZoom: 1.2,
          maxZoom: 9,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
          pixelRatio: Math.min(devicePixelRatio, 2),
        });
      } catch {
        fail(); // no WebGL
        return;
      }
      map.current = m;
      m.touchZoomRotate.disableRotation();
      m.on("webglcontextlost", fail);
      m.on("error", (e) => {
        if ((e.error as Error | undefined)?.name === "GPUInitializationError") fail(); // the context could not be made again after a loss
      });
      m.on("load", () => {
        addOverlays(m);
        // The wind's canvas goes in a layer of its own, a little fainter and faded out towards the globe's edge and the card.
        const veil = document.createElement("div");
        veil.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0.62;mask-image:linear-gradient(to bottom,transparent 8%,#000 28%,#000 62%,transparent 92%)";
        m.getCanvasContainer().appendChild(veil);
        setWindView({ ...globeView(m), container: veil });
        setReady(true);
      });
    }).catch(fail); // the basemap style would not load
    return () => {
      live = false;
      map.current?.remove();
      map.current = undefined;
      field.current = undefined;
      setReady(false);
      setWindView(undefined);
    };
  }, []);

  // The day's fires, zones, path and wind.
  const geo = useMemo(() => frameGeo(day), [day]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const id of ["fires", "older", "fresh", "trail", "hours", "ahead"] as const) (m.getSource(id) as GeoJSONSource).setData(geo[id]);
  }, [ready, geo]);

  const { lats, lons } = day.grid;
  const wind = day.wind;
  const flow = useMemo(() => flowOf({ lats, lons }, wind && { u: wind.u, v: wind.v }), [lats, lons, wind]);
  useWindParticles(windView, flow, !reduced || motion, "#ffffff");

  // A pollutant's field: one canvas, drawn again for each step and shown only for a pollutant layer.
  const values = day.field;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const show = layer !== "off" && layer !== "smoke" && values != null && lats.length > 1 && lons.length > 1;
    if (!show) {
      if (m.getLayer("pm")) m.setLayoutProperty("pm", "visibility", "none");
      return;
    }
    field.current = drawField({ lats, lons }, values, layer, field.current);
    const corners = fieldCorners({ lats, lons });
    const source = m.getSource("pm") as CanvasSource | undefined;
    if (source) {
      source.setCoordinates(corners);
      source.play(); // MapLibre reads the canvas again when it is played and paused
      source.pause();
      m.setLayoutProperty("pm", "visibility", "visible");
    } else {
      m.addSource("pm", { type: "canvas", canvas: field.current, coordinates: corners, animate: false });
      m.addLayer({ id: "pm", type: "raster", source: "pm", paint: { "raster-resampling": "linear", "raster-fade-duration": 0 } }, FIRST);
    }
  }, [ready, layer, values, lats, lons]);

  // The satellite picture, asked for only while it is the layer.
  const picture = layer === "smoke" ? satDate : null;
  useEffect(() => {
    const m = map.current;
    if (ready && m) setSatellite(m, picture);
  }, [ready, picture]);

  // The camera: the tilted view of the region, or the air's path. Moves again when the path does.
  const trail = day.trail;
  const trailKey = `${trail.length}/${trail[0]?.join(",")}/${trail.at(-1)?.join(",")}`;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const { clientWidth: w, clientHeight: h } = box.current!;
    const cam = (view === "path" && pathCamera(m, trail, w)) || homeCamera(w, h);
    const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
    m.easeTo({ ...cam, duration: quiet ? 0 : intro.current ? INTRO_MS : MOVE_MS, easing: ease });
    intro.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trailKey stands for the path: the camera moves when it changes, not for each new array
  }, [ready, view, trailKey]);

  return (
    <div className="relative size-full overflow-hidden bg-[#02030a] text-white">
      <div ref={box} className="size-full" />
      {reduced && <WindMotionButton motion={motion} onToggle={toggle} className="absolute right-3 top-[4.75rem] z-10" />}
    </div>
  );
}
