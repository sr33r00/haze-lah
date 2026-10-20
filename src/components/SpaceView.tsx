"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GlobeMethods } from "react-globe.gl";
import type { WebGLRenderer } from "three";
import { fmtRange } from "@/lib/format";
import { GLOBE_CREDIT, GLOBE_LAYERS, REGION, globeDays, globePoster, globeTexture, rampCss, type GlobeLayer } from "@/lib/globe";
import { onImage } from "@/lib/satellite";
import { SG } from "@/lib/util";
import SgPin from "./SgPin";

const CHIP = "min-h-[32px] min-w-0 flex-auto rounded-full px-3 text-[12px] font-semibold transition-colors";
const IDLE_MS = 1500; // the globe stops drawing this long after the last touch
const FADE = "transition-opacity duration-700 motion-reduce:transition-none";
const R = "max(100cqw, 150cqh)"; // width of the region (REGION is 3:2) when it just covers the stage
const CENTRE = { lat: (REGION[0] + REGION[2]) / 2, lon: (REGION[1] + REGION[3]) / 2 };
const REGION_LON = REGION[3] - REGION[1];

/** Places an image of `box` so that REGION is centred in the stage and fills it. */
function posterStyle(box: readonly [number, number, number, number]): CSSProperties {
  return {
    width: `calc(${R} * ${(box[3] - box[1]) / REGION_LON})`,
    height: `calc(${R} * ${(box[2] - box[0]) / REGION_LON})`,
    left: `calc(50cqw - ${R} * ${(CENTRE.lon - box[1]) / REGION_LON})`,
    top: `calc(50cqh - ${R} * ${(box[2] - CENTRE.lat) / REGION_LON})`,
  };
}

type Connection = { saveData?: boolean; effectiveType?: string };

/** The globe only loads where it will run well: WebGL, no data saver, not 2G, no reduced-motion preference. */
function canRunGlobe() {
  const net = (navigator as Navigator & { connection?: Connection }).connection;
  if (net?.saveData || /2g$/.test(net?.effectiveType ?? "")) return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** Singapore's ring and label as a DOM element on the globe. */
function marker() {
  const el = document.createElement("div");
  el.className = "pointer-events-none relative";
  el.innerHTML =
    '<span class="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"></span>' +
    '<span class="absolute left-2.5 -translate-y-1/2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">Singapore</span>';
  return el;
}

/**
 * NASA satellite pollution data on a 3D globe. A flat poster of Southeast Asia is the whole experience until the
 * stage is on screen, the browser is idle and the device can run WebGL; then the globe loads and fades in over it.
 * `now` comes from the server so both renders build the same URLs.
 */
export default function SpaceView({ now }: { now: number }) {
  const [layer, setLayer] = useState<GlobeLayer>("co");
  const [Globe, setGlobe] = useState<typeof import("react-globe.gl").default>();
  const [capable, setCapable] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false); // the globe takes touches only after "Drag to explore"
  const [size, setSize] = useState({ w: 0, h: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods>(undefined);
  const renderer = useRef<WebGLRenderer>(undefined);
  const idle = useRef<number>(undefined);

  const { label, ramp, note } = GLOBE_LAYERS[layer];
  const range = useMemo(() => {
    const days = globeDays(layer, now);
    return fmtRange(days[0], days.at(-1)!);
  }, [layer, now]);
  const texture = globeTexture(layer, now);
  const poster = globePoster(layer, now);
  const at = onImage(SG.lat, SG.lon, poster.box);
  const [onGlobe, setOnGlobe] = useState(texture); // the texture on the globe, swapped once the next one has loaded

  useEffect(() => {
    setCapable(canRunGlobe());
    const el = stage.current!;
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "100px" });
    const measure = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    seen.observe(el);
    measure.observe(el);
    return () => {
      seen.disconnect();
      measure.disconnect();
    };
  }, []);

  // Load the globe code when the stage is in view and the browser has nothing better to do.
  useEffect(() => {
    if (!capable || !inView || Globe) return;
    let live = true;
    const load = () => import("react-globe.gl").then((m) => live && setGlobe(() => m.default));
    const handle = "requestIdleCallback" in window ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 300);
    return () => {
      live = false;
      if ("cancelIdleCallback" in window) cancelIdleCallback(handle as number);
      else clearTimeout(handle);
    };
  }, [capable, inView, Globe]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the same kind of request as the globe's, so it is then served from cache
    img.onload = () => setOnGlobe(texture);
    img.src = texture;
  }, [texture]);

  // Draw while something is happening; stop after a quiet moment or when off screen.
  const wake = useCallback(() => {
    globe.current?.resumeAnimation();
    clearTimeout(idle.current);
    idle.current = window.setTimeout(() => globe.current?.pauseAnimation(), IDLE_MS);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (inView) wake();
    else {
      clearTimeout(idle.current);
      globe.current?.pauseAnimation();
    }
  }, [ready, inView, size, onGlobe, wake]);
  useEffect(
    () => () => {
      clearTimeout(idle.current);
      renderer.current?.forceContextLoss(); // react-globe.gl disposes the renderer on unmount; this frees the GPU context too
    },
    [],
  );

  const onReady = () => {
    const g = globe.current!;
    renderer.current = g.renderer();
    renderer.current.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const controls = g.controls();
    controls.minDistance = 100 * 1.6; // globe radius is 100; stay between altitude 0.6 and 3
    controls.maxDistance = 100 * 4;
    g.pointOfView({ lat: 2, lng: 108, altitude: size.w < 500 ? 2.2 : 1.7 });
    setReady(true);
  };

  return (
    <div className="px-4">
      <div role="group" aria-label="Choose layer" className="mb-2 flex gap-1 rounded-full bg-surface p-1">
        {(Object.keys(GLOBE_LAYERS) as GlobeLayer[]).map((key) => (
          <button key={key} onClick={() => setLayer(key)} aria-pressed={layer === key} className={`${CHIP} ${layer === key ? "bg-fg text-bg" : "text-muted"}`}>
            {GLOBE_LAYERS[key].label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        onPointerDown={wake}
        onPointerMove={() => active && wake()}
        className="relative aspect-square max-h-[640px] overflow-hidden rounded-3xl bg-[#05070d] [container-type:size] sm:aspect-[16/9]"
      >
        <div aria-hidden={ready} className={`absolute inset-0 ${FADE} ${ready ? "opacity-0" : ""}`}>
          <div className="absolute" style={posterStyle(poster.box)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- NASA serves sized images; no optimisation needed */}
            <img src={poster.url} alt={`${label}, satellite view of Southeast Asia, ${range}`} loading="lazy" decoding="async" className="size-full max-w-none" />
            <SgPin at={at} />
          </div>
        </div>

        {Globe && size.w > 0 && (
          <div aria-hidden onWheelCapture={(e) => e.stopPropagation()} className={`absolute inset-0 ${FADE} ${ready ? "" : "opacity-0"} ${active ? "" : "pointer-events-none"}`}>
            <Globe
              ref={globe}
              width={size.w}
              height={size.h}
              globeImageUrl={onGlobe}
              backgroundColor="rgba(0,0,0,0)"
              atmosphereColor="#7fb2ff"
              atmosphereAltitude={0.18}
              rendererConfig={{ powerPreference: "low-power" }}
              htmlElementsData={[SG]}
              htmlLat="lat"
              htmlLng="lon"
              htmlElement={marker}
              onGlobeReady={onReady}
            />
          </div>
        )}

        <span className="tabular absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white" aria-live="polite">
          {range}
        </span>
        {ready && (
          <button
            onClick={() => setActive(!active)}
            aria-pressed={active}
            className="absolute bottom-3 left-1/2 min-h-11 -translate-x-1/2 rounded-full bg-black/60 px-4 text-[13px] font-semibold text-white backdrop-blur"
          >
            {active ? "Done" : "Drag to explore"}
          </button>
        )}
      </div>

      <div className="mt-3 text-[13px] text-muted">
        {ramp && (
          <p className="tabular mb-1 flex items-center gap-2 text-[12px]">
            <span className="font-semibold">{ramp.unit}</span>
            {ramp.range[0]}
            <span aria-hidden className="h-2 flex-1 rounded-full" style={{ background: rampCss(ramp) }} />
            {ramp.range[1]}+
          </p>
        )}
        <p aria-live="polite">{note}</p>
      </div>
      <p className="mt-1 text-[12px] text-muted">{GLOBE_CREDIT}</p>
    </div>
  );
}
