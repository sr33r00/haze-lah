"use client";

import { Map as MapLibre, Marker, NavigationControl, Popup, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type ImageSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Globe, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BASEMAP, trimStyle } from "@/lib/basemap";
import { DATA_OPACITY, GLOBE_LAYERS, MERC_LAT, fmtReading, isClear, mercY, rampRgb, type GlobeLayer } from "@/lib/globe";
import { FIRE_COLOR, TRAIL_COLOR } from "@/lib/replay";
import type { Fire, Replay, ReplayDay } from "@/lib/types";
import { SG } from "@/lib/util";

// MapLibre's worker is a file of its own; the bundler puts it among the static files and this is its address.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const MIN_ZOOM = 1.2;
const MAX_ZOOM = 9;
const SPAN = 36; // degrees of the Earth across the card's short side at the start: Southeast Asia fills it
const FLY_MS = 800;
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

/** The wind on the replay's grid, at one moment. */
export type Flow = Pick<Replay, "lats" | "lons"> & { wind: ReplayDay["wind"] };

const ARROW = 64; // the arrow's picture, in pixels: drawn at pixelRatio 2, so 32 on screen
const ARROW_EDGE = [[32, 10], [46, 30], [37, 30], [37, 54], [27, 54], [27, 30], [18, 30]]; // an arrow pointing north
const SDF_RADIUS = 8; // how far the distance field reaches, in pixels
const SDF_CUTOFF = 0.25; // where the edge sits in it: the same encoding as MapLibre's glyphs

/** Distance from (x, y) to the arrow's outline, negative inside it. */
function arrowDistance(x: number, y: number) {
  let near = Infinity;
  let inside = false;
  ARROW_EDGE.forEach(([ax, ay], i) => {
    const [bx, by] = ARROW_EDGE[(i + 1) % ARROW_EDGE.length];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    near = Math.min(near, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)));
    if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
  });
  return inside ? -near : near;
}

/** The wind arrow as a signed distance field, so that MapLibre can colour it and give it a halo. Drawn once. */
function arrowImage() {
  const data = new Uint8ClampedArray(ARROW * ARROW * 4).fill(255);
  for (let y = 0; y < ARROW; y++)
    for (let x = 0; x < ARROW; x++) data[(y * ARROW + x) * 4 + 3] = Math.max(0, Math.min(255, Math.round(255 - 255 * (arrowDistance(x + 0.5, y + 0.5) / SDF_RADIUS + SDF_CUTOFF))));
  return new ImageData(data, ARROW, ARROW);
}

/** One arrow per grid point: `speed` in m/s, `bearing` in degrees clockwise from north, the way the wind blows. Every second point is `major`, so that a wide view can show fewer. */
const arrows = (flow: Flow | undefined): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: flow
    ? flow.lats.flatMap((lat, i) =>
        flow.lons.flatMap((lon, j) => {
          const u = flow.wind.u[i * flow.lons.length + j];
          const v = flow.wind.v[i * flow.lons.length + j];
          if (!Number.isFinite(u) || !Number.isFinite(v)) return [];
          const bearing = (Math.atan2(u, v) * 180) / Math.PI;
          return [{ type: "Feature" as const, properties: { speed: Math.hypot(u, v), bearing: (bearing + 360) % 360, major: i % 2 === 0 && j % 2 === 0 ? 1 : 0 }, geometry: { type: "Point" as const, coordinates: [lon, lat] } }];
        }),
      )
    : [],
});

/** Arrow size (1 is the picture's own size) by wind speed, scaled by `k`. */
const arrowSize = (k: number): ExpressionSpecification => ["interpolate", ["linear"], ["get", "speed"], 0, 0.35 * k, 15, 0.9 * k];

/**
 * Southeast Asia on a globe you can turn, zoom and move: MapLibre with OpenFreeMap's vector map, so that coasts, borders and
 * names stay sharp at any zoom, and the NASA picture laid between them and the colours. Fills the card it is in. `fires`,
 * `trail` (where the air came from), `ahead` (where today's smoke should go) and `flow` (the wind, as arrows) are drawn when given; `url` is the picture to lay (undefined until the browser has it, so that it is read from its
 * cache and not fetched twice; the map and the fly-in do not wait for it, and it fades in); `onReady` says the map is up,
 * `onFail` that it could not start. MapLibre draws only when something moves or loads.
 */
export default function GlobeMap({
  url,
  layer,
  fires,
  trail,
  ahead,
  flow,
  onReady,
  onFail,
}: {
  url: string | undefined;
  layer: GlobeLayer;
  fires: Fire[];
  trail: ReplayDay["trail"] | undefined;
  ahead: ReplayDay["trail"] | undefined;
  flow: Flow | undefined;
  onReady: () => void;
  onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>(undefined);
  const home = useRef(0); // the zoom the map starts at and comes back to
  const shown = useRef<string>(undefined); // the picture it has now
  const now = useRef<{ url?: string; layer: GlobeLayer }>({ layer }); // what a click reads
  const frame = useRef<{ url: string; ctx: Promise<CanvasRenderingContext2D> }>(undefined);
  const [ready, setReady] = useState(false);
  const [styled, setStyled] = useState(false); // the style is loaded: layers can be added
  const [away, setAway] = useState(false); // the view has moved off Singapore
  const [hint, setHint] = useState(true); // how to use the map, until the first drag or zoom

  useEffect(() => {
    if (url) now.current = { url, layer };
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
          scrollZoom: false, // the wheel scrolls the page; zoom with the buttons, a double click or a pinch
          touchZoomRotate: { around: "center" },
          touchPitch: false,
          pitchWithRotate: false,
          maxPitch: 0,
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
          const firstLabel = layers.find((l) => l.type === "symbol")!.id;
          // The wind, fires and the air's paths go between the borders and the names, the paths on top; the data, under the borders, is added once its picture is here.
          // The arrows fade in with zoom, the minor ones last, so that the first view stays clear.
          m.addImage("arrow", arrowImage(), { sdf: true, pixelRatio: 2 });
          m.addSource("wind", { type: "geojson", data: arrows(undefined) });
          m.addLayer(
            {
              id: "wind",
              type: "symbol",
              source: "wind",
              layout: {
                "icon-image": "arrow",
                "icon-rotate": ["get", "bearing"],
                "icon-rotation-alignment": "map",
                "icon-pitch-alignment": "map",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, arrowSize(0.7), 6, arrowSize(1.2)],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              paint: {
                "icon-color": "#ffffff",
                "icon-halo-color": "rgba(0,0,0,0.6)",
                "icon-halo-width": 1.2,
                "icon-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0, 2.6, ["*", 0.75, ["get", "major"]], 4, ["*", 0.75, ["get", "major"]], 5, 0.75],
                "icon-opacity-transition": { duration: 0 },
              },
            },
            firstLabel,
          );
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
          m.addSource("ahead", { type: "geojson", data: line([]) });
          m.addLayer({ id: "ahead", type: "line", source: "ahead", layout: { "line-join": "round" }, paint: { "line-color": FIRE_COLOR, "line-dasharray": [2, 1.5], "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 8, 3] } }, firstLabel);
          m.addSource("trail", { type: "geojson", data: line([]) });
          const trailLine = { type: "line", source: "trail", layout: { "line-cap": "round", "line-join": "round" } } as const;
          m.addLayer({ ...trailLine, id: "trail-glow", paint: { "line-color": TRAIL_COLOR, "line-opacity": 0.3, "line-blur": 3, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 5, 8, 10] } }, firstLabel);
          m.addLayer({ ...trailLine, id: "trail", paint: { "line-color": TRAIL_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 8, 3] } }, firstLabel);
          setStyled(true);
          if (!still) m.easeTo({ zoom: home.current, duration: FLY_MS });
        });
        m.once("load", () => {
          setReady(true);
          onReady();
        });
        m.on("movestart", (e) => e.originalEvent && setHint(false));
        m.on("moveend", () => {
          const c = m.getCenter();
          setAway(Math.hypot(c.lng - SG.lon, c.lat - SG.lat) > 1 || Math.abs(m.getZoom() - home.current) > 0.5);
        });
        m.on("click", (e) => {
          const { url: at, layer: of } = now.current;
          if (!at) return;
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

  // The first picture is laid under the borders and fades in; a new day or layer is a swap of it. Fires and the air's path are only there when given.
  useEffect(() => {
    const m = map.current;
    if (!styled || !m || !url || shown.current === url) return;
    shown.current = url;
    const source = m.getSource("data") as ImageSource | undefined;
    if (source) return void source.updateImage({ url });
    m.addSource("data", { type: "image", url, coordinates: CORNERS });
    m.addLayer(
      { id: "data", type: "raster", source: "data", paint: { "raster-opacity": 0, "raster-resampling": "linear", "raster-fade-duration": 0 } },
      m.getStyle().layers.find((l) => l.type === "line")!.id,
    );
    m.once("idle", () => m.setPaintProperty("data", "raster-opacity", DATA_OPACITY)); // idle: the picture is drawn
  }, [styled, url]);
  useEffect(() => {
    if (ready) (map.current!.getSource("fires") as GeoJSONSource).setData(points(fires));
  }, [ready, fires]);
  useEffect(() => {
    if (ready) (map.current!.getSource("trail") as GeoJSONSource).setData(line(trail ?? []));
  }, [ready, trail]);
  useEffect(() => {
    if (ready) (map.current!.getSource("ahead") as GeoJSONSource).setData(line(ahead ?? []));
  }, [ready, ahead]);
  useEffect(() => {
    if (ready) (map.current!.getSource("wind") as GeoJSONSource).setData(arrows(flow));
  }, [ready, flow]);

  return (
    <>
      <div ref={box} className="size-full" />
      {ready && (
        <button
          onClick={() => {
            setHint(false);
            map.current?.easeTo({ center: HOME, zoom: away ? home.current : MIN_ZOOM, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800 });
          }}
          className="absolute right-14 top-2.5 z-10 flex h-10 items-center gap-1.5 rounded-full bg-black/70 px-3 text-[12px] font-semibold text-white"
        >
          {away ? <LocateFixed size={14} aria-hidden /> : <Globe size={14} aria-hidden />}
          {away ? "Back to Singapore" : "Whole globe"}
        </button>
      )}
      {ready && hint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 mx-auto w-fit rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-semibold text-white">
          Drag to move · Zoom out to see the whole globe
        </p>
      )}
    </>
  );
}
