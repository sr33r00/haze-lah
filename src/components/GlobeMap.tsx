"use client";

import { Map as MapLibre, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type ImageSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BASEMAP, trimStyle } from "@/lib/basemap";
import { DATA_OPACITY, GLOBE_LAYERS, MERC_LAT, fmtReading, isClear, mercY, rampRgb, type GlobeLayer } from "@/lib/globe";
import { FIRE_COLOR, TRAIL_COLOR } from "@/lib/replay";
import type { Fire, ReplayDay } from "@/lib/types";
import { SG } from "@/lib/util";

// MapLibre's worker is a file of its own; the bundler puts it among the static files and this is its address.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const MIN_ZOOM = 1.2;
const MAX_ZOOM = 9;
const SPAN = 36; // degrees of the Earth across the card's short side at the start: Southeast Asia fills it
const FLY_MS = 1500;
const HOME: [number, number] = [SG.lon, SG.lat];
const CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [[-180, MERC_LAT], [180, MERC_LAT], [180, -MERC_LAT], [-180, -MERC_LAT]];

/** Singapore's pulsing ring and label as a DOM element on the map. The label sits above, clear of the air's path. */
function marker() {
  const el = document.createElement("div");
  el.className = "pointer-events-none relative";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="sg-ring"></span><span class="sg-label bottom-3 left-0 -translate-x-1/2">Singapore</span>';
  return el;
}

/** A picture drawn once on a canvas, so that its colours can be read back at any point. */
async function drawn(url: string) {
  const img = new Image();
  img.src = url; // the same address MapLibre fetched, so the browser has it already
  await img.decode();
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  ctx.canvas.width = img.naturalWidth;
  ctx.canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  return ctx;
}

/** What the picture says at `lat`, `lon`: the value whose ramp colour is nearest to the pixel's, as text. No request: the picture is the one on the map. */
function readAt(ctx: CanvasRenderingContext2D, layer: GlobeLayer, lat: number, lon: number) {
  const n = ctx.canvas.width;
  const clamped = Math.max(-MERC_LAT, Math.min(MERC_LAT, lat));
  const [r, g, b, a] = ctx.getImageData(Math.min(n - 1, ((lon + 180) / 360) * n | 0), Math.min(n - 1, mercY(clamped) * n | 0), 1, 1).data;
  if (a < 128) return isClear(layer, 0) ? "clear" : "no data";
  const { ramp } = GLOBE_LAYERS[layer];
  let best = 0;
  let near = Infinity;
  for (let i = 0; i < 256; i++) {
    const [cr, cg, cb] = rampRgb(ramp, i / 255);
    const d = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
    if (d < near) [best, near] = [i, d];
  }
  return fmtReading(layer, ramp.range[0] + (best / 255) * (ramp.range[1] - ramp.range[0]), true);
}

const points = (fires: Fire[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: fires.map((f) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [f.lon, f.lat] } })),
});
const line = (trail: ReplayDay["trail"]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: trail.length ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trail.map(([lat, lon]) => [lon, lat]) } }] : [],
});

/**
 * Southeast Asia on a globe you can turn, zoom and move: MapLibre with OpenFreeMap's vector map, so that coasts, borders and
 * names stay sharp at any zoom, and the NASA picture laid between them and the colours. Fills the card it is in. `fires` and
 * `trail` are drawn when given; `onReady` says the first picture is up, `onFail` that the map could not start. MapLibre draws
 * only when something moves or loads.
 */
export default function GlobeMap({
  url,
  layer,
  fires,
  trail,
  onReady,
  onFail,
}: {
  url: string;
  layer: GlobeLayer;
  fires: Fire[];
  trail: ReplayDay["trail"] | undefined;
  onReady: () => void;
  onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>(undefined);
  const home = useRef(0); // the zoom the map starts at and comes back to
  const first = useRef(url); // the picture the map starts with
  const shown = useRef(url); // the picture it has now
  const now = useRef({ url, layer }); // what a click reads
  const frame = useRef<{ url: string; ctx: Promise<CanvasRenderingContext2D> }>(undefined);
  const [ready, setReady] = useState(false);
  const [away, setAway] = useState(false); // the view has moved off Singapore

  useEffect(() => {
    now.current = { url, layer };
  }, [url, layer]);

  useEffect(() => {
    const el = box.current!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let live = true;
    fetch(BASEMAP)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((style) => {
        if (!live) return;
        home.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.log2((Math.min(el.clientWidth, el.clientHeight) / SPAN) * (360 / 512))));
        const m = new MapLibre({
          container: el,
          style: trimStyle(style),
          center: HOME,
          zoom: still ? home.current : MIN_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          dragRotate: false, // north stays up
          scrollZoom: { around: "center" }, // a globe cannot ease around a point
          touchZoomRotate: { around: "center" },
          touchPitch: false,
          pitchWithRotate: false,
          maxPitch: 0,
          cooperativeGestures: true, // one finger and the wheel scroll the page; the map takes two fingers or ctrl and the wheel
          attributionControl: { compact: true },
          canvasContextAttributes: { powerPreference: "low-power" },
          pixelRatio: Math.min(devicePixelRatio, 2),
        });
        map.current = m;
        m.touchZoomRotate.disableRotation();
        m.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
        new Marker({ element: marker() }).setLngLat(HOME).addTo(m);

        m.once("style.load", () => {
          m.setProjection({ type: "globe" });
          const { layers } = m.getStyle();
          const firstLine = layers.find((l) => l.type === "line")!.id;
          const firstLabel = layers.find((l) => l.type === "symbol")!.id;
          // The data goes under the borders and names; fires and the air's path between them and the names.
          m.addSource("data", { type: "image", url: first.current, coordinates: CORNERS });
          m.addLayer({ id: "data", type: "raster", source: "data", paint: { "raster-opacity": DATA_OPACITY, "raster-resampling": "linear", "raster-fade-duration": 0 } }, firstLine);
          m.addSource("fires", { type: "geojson", data: points([]) });
          m.addLayer(
            {
              id: "fires-heat",
              type: "heatmap",
              source: "fires",
              paint: {
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 6, 14],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 6, 0.7],
                "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(194,65,12,0)", 0.3, "rgba(194,65,12,0.45)", 0.7, "rgba(234,88,12,0.8)", 1, "rgba(251,146,60,0.95)"],
                "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 6.5, 0],
              },
            },
            firstLabel,
          );
          m.addLayer(
            {
              id: "fires",
              type: "circle",
              source: "fires",
              minzoom: 5.5,
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 5.5, 2, 9, 5],
                "circle-color": FIRE_COLOR,
                "circle-stroke-color": "#fff7ed",
                "circle-stroke-width": 0.8,
                "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.5, 1],
                "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.5, 1],
              },
            },
            firstLabel,
          );
          m.addSource("trail", { type: "geojson", data: line([]) });
          const trailLine = { type: "line", source: "trail", layout: { "line-cap": "round", "line-join": "round" } } as const;
          m.addLayer({ ...trailLine, id: "trail-glow", paint: { "line-color": TRAIL_COLOR, "line-opacity": 0.3, "line-blur": 3, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 5, 8, 10] } }, firstLabel);
          m.addLayer({ ...trailLine, id: "trail", paint: { "line-color": TRAIL_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 8, 3] } }, firstLabel);
        });
        m.once("load", () => {
          setReady(true);
          onReady();
          if (!still) m.easeTo({ zoom: home.current, duration: FLY_MS });
        });
        m.on("moveend", () => {
          const c = m.getCenter();
          setAway(Math.hypot(c.lng - SG.lon, c.lat - SG.lat) > 1 || Math.abs(m.getZoom() - home.current) > 0.5);
        });
        m.on("click", (e) => {
          const { url: at, layer: of } = now.current;
          const { lat, lng } = e.lngLat.wrap();
          if (frame.current?.url !== at) frame.current = { url: at, ctx: drawn(at) };
          frame.current.ctx
            .then((ctx) => new Popup({ closeButton: false, maxWidth: "none", className: "sg-pop" }).setLngLat(e.lngLat).setText(readAt(ctx, of, lat, lng)).addTo(m))
            .catch(() => {});
        });
      })
      .catch(() => live && onFail());
    return () => {
      live = false;
      map.current?.remove();
      map.current = undefined;
      frame.current = undefined;
    };
  }, [onReady, onFail]);

  // A new day or layer is a swap of the picture; fires and the air's path are only there when given.
  useEffect(() => {
    if (!ready || shown.current === url) return;
    shown.current = url;
    (map.current!.getSource("data") as ImageSource).updateImage({ url });
  }, [ready, url]);
  useEffect(() => {
    if (ready) (map.current!.getSource("fires") as GeoJSONSource).setData(points(fires));
  }, [ready, fires]);
  useEffect(() => {
    if (ready) (map.current!.getSource("trail") as GeoJSONSource).setData(line(trail ?? []));
  }, [ready, trail]);

  return (
    <>
      <div ref={box} className="size-full" />
      {away && (
        <button
          aria-label="Centre the map on Singapore"
          onClick={() => map.current?.easeTo({ center: HOME, zoom: home.current, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800 })}
          className="absolute right-14 top-2.5 z-10 flex h-10 items-center gap-1.5 rounded-full bg-black/70 px-3 text-[12px] font-semibold text-white"
        >
          <LocateFixed size={14} aria-hidden />
          Singapore
        </button>
      )}
    </>
  );
}
