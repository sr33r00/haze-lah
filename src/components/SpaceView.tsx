"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GlobeMethods } from "react-globe.gl";
import type { MeshBasicMaterial, Texture, WebGLRenderer } from "three";
import { fmtRange } from "@/lib/format";
import { GLOBE_CREDIT, GLOBE_LAYERS, REGION, globeDays, globeTexture, rampCss, type GlobeLayer } from "@/lib/globe";
import { FIRE_COLOR, TRAIL_COLOR, fetchReplay } from "@/lib/replay";
import { WORLD_BOX, onImage } from "@/lib/satellite";
import type { Fire } from "@/lib/types";
import { SG } from "@/lib/util";
import SgPin from "./SgPin";

const CHIP = "min-h-[32px] min-w-0 flex-auto rounded-full px-3 text-[12px] font-semibold transition-colors";
const IDLE_MS = 1500; // the globe stops drawing this long after the last touch
const INTRO_MS = 1200; // the camera settles from far away
const LAYERS = Object.keys(GLOBE_LAYERS) as GlobeLayer[];
const AT_SG = onImage(SG.lat, SG.lon, WORLD_BOX);
type Trail = [number, number][];
const FADE = "transition-opacity duration-700 motion-reduce:transition-none";
const R = "max(100cqw, 150cqh)"; // width of the region (REGION is 3:2) when it just covers the stage
const CENTRE = { lat: (REGION[0] + REGION[2]) / 2, lon: (REGION[1] + REGION[3]) / 2 };
const REGION_LON = REGION[3] - REGION[1];

/** Places the world image so that REGION is centred in the stage and fills it. */
const POSTER: CSSProperties = {
  width: `calc(${R} * ${(WORLD_BOX[3] - WORLD_BOX[1]) / REGION_LON})`,
  height: `calc(${R} * ${(WORLD_BOX[2] - WORLD_BOX[0]) / REGION_LON})`,
  left: `calc(50cqw - ${R} * ${(CENTRE.lon - WORLD_BOX[1]) / REGION_LON})`,
  top: `calc(50cqh - ${R} * ${(WORLD_BOX[2] - CENTRE.lat) / REGION_LON})`,
};

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

/** Singapore's ring and label as a DOM element on the globe. The label sits above, clear of the air's path. */
function marker() {
  const el = document.createElement("div");
  el.className = "pointer-events-none relative";
  el.innerHTML =
    '<span class="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"></span>' +
    '<span class="absolute bottom-3 left-0 -translate-x-1/2 rounded bg-black/70 px-1.5 text-[11px] font-semibold text-white">Singapore</span>';
  return el;
}

type Kit = { Globe: typeof import("react-globe.gl").default; maps: Record<GlobeLayer, Texture>; material: MeshBasicMaterial };

/** The globe code and both layer textures, fetched together so that switching layers later is only a swap. */
async function loadKit(): Promise<Kit> {
  const [{ default: Globe }, THREE] = await Promise.all([import("react-globe.gl"), import("three")]);
  const loader = new THREE.TextureLoader().setCrossOrigin("anonymous"); // the same kind of request as the poster's, so it is served from cache
  const loaded = await Promise.all(LAYERS.map((key) => loader.loadAsync(globeTexture(key))));
  const maps = Object.fromEntries(LAYERS.map((key, i) => [key, loaded[i]])) as Record<GlobeLayer, Texture>;
  loaded.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));
  // Ignores lights, so the data colours are shown as they are, with no highlight.
  return { Globe, maps, material: new THREE.MeshBasicMaterial({ map: maps[LAYERS[0]] }) };
}

const fireLat = (f: object) => (f as Fire).lat;
const fireLng = (f: object) => (f as Fire).lon;
const fireColor = () => FIRE_COLOR;
const trailPoints = (t: object) => t as Trail;
const trailLat = (p: [number, number]) => p[0];
const trailLng = (p: [number, number]) => p[1];
const trailColor = () => TRAIL_COLOR;

/**
 * NASA satellite pollution data on a 3D globe. A flat poster of Southeast Asia is the whole experience until the
 * stage is on screen, the browser is idle and the device can run WebGL; then the globe loads and fades in over it.
 * `now` comes from the server so both renders build the same URLs; `fires` are the strongest recent detections.
 */
export default function SpaceView({ now, fires }: { now: number; fires: Fire[] }) {
  const [layer, setLayer] = useState<GlobeLayer>(LAYERS[0]);
  const [kit, setKit] = useState<Kit>();
  const [trail, setTrail] = useState<Trail>(); // today's air path, if it could be fetched
  const [capable, setCapable] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods>(undefined);
  const renderer = useRef<WebGLRenderer>(undefined);
  const idle = useRef<number>(undefined);

  const { label, ramp, note } = GLOBE_LAYERS[layer];
  const ranges = useMemo(
    () =>
      Object.fromEntries(
        LAYERS.map((key) => {
          const days = globeDays(key, now);
          return [key, fmtRange(days[0], days.at(-1)!)];
        }),
      ) as Record<GlobeLayer, string>,
    [now],
  );
  const paths = useMemo(() => (trail ? [trail] : []), [trail]);

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

  // Load the globe code and textures when the stage is in view and the browser has nothing better to do.
  useEffect(() => {
    if (!capable || !inView || kit) return;
    let live = true;
    const load = () => {
      loadKit()
        .then((k) => live && setKit(k))
        .catch(() => {}); // the poster stays
      fetchReplay()
        .then((r) => live && setTrail(r.days.at(-1)?.trail))
        .catch(() => {});
    };
    const handle = "requestIdleCallback" in window ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 300);
    return () => {
      live = false;
      if ("cancelIdleCallback" in window) cancelIdleCallback(handle as number);
      else clearTimeout(handle);
    };
  }, [capable, inView, kit]);
  useEffect(() => () => Object.values(kit?.maps ?? {}).forEach((t) => t.dispose()), [kit]);

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
  }, [ready, inView, size, layer, wake]);
  // Switching layers is only a swap of the picture on the globe.
  useEffect(() => {
    if (ready) kit!.material.map = kit!.maps[layer];
  }, [ready, kit, layer]);
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
    Object.values(kit!.maps).forEach((t) => renderer.current!.initTexture(t)); // on the GPU already, so the first switch has no hitch
    const controls = g.controls();
    controls.minDistance = 100 * 1.6; // globe radius is 100; stay between altitude 0.6 and 3
    controls.maxDistance = 100 * 4;
    controls.domElement!.style.touchAction = "pan-y"; // sideways drags spin the globe; up and down still scrolls the page
    const rest = { lat: 2, lng: 108, altitude: size.w < 500 ? 2.2 : 1.7 };
    g.pointOfView({ ...rest, altitude: 3.2 });
    g.pointOfView(rest, INTRO_MS);
    setReady(true);
  };

  return (
    <div className="px-4">
      <div role="group" aria-label="Choose layer" className="mb-2 flex gap-1 rounded-full bg-surface p-1">
        {LAYERS.map((key) => (
          <button key={key} onClick={() => setLayer(key)} aria-pressed={layer === key} className={`${CHIP} ${layer === key ? "bg-fg text-bg" : "text-muted"}`}>
            {GLOBE_LAYERS[key].label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        onPointerDown={wake}
        onPointerMove={(e) => e.buttons && wake()}
        className="stars relative aspect-square max-h-[640px] overflow-hidden rounded-3xl [container-type:size] sm:aspect-[16/9]"
      >
        <div aria-hidden={ready} className={`absolute inset-0 ${FADE} ${ready ? "opacity-0" : ""}`}>
          <div className="absolute" style={POSTER}>
            {/* Both stay mounted, so switching layers swaps them with no wait. */}
            {LAYERS.map((key) => (
              // eslint-disable-next-line @next/next/no-img-element -- the server builds sized images; no optimisation needed
              <img
                key={key}
                src={globeTexture(key)}
                alt={key === layer ? `${label}, satellite view of Southeast Asia, ${ranges[key]}` : ""}
                aria-hidden={key !== layer}
                loading="lazy"
                decoding="async"
                className={`absolute size-full max-w-none ${key === layer ? "" : "opacity-0"}`}
              />
            ))}
            <SgPin at={AT_SG} />
          </div>
        </div>

        {kit && size.w > 0 && (
          <div aria-hidden onWheelCapture={(e) => e.stopPropagation()} className={`absolute inset-0 ${FADE} ${ready ? "" : "opacity-0"}`}>
            <kit.Globe
              ref={globe}
              width={size.w}
              height={size.h}
              globeMaterial={kit.material}
              backgroundColor="rgba(0,0,0,0)"
              atmosphereColor="#7fb2ff"
              atmosphereAltitude={0.18}
              rendererConfig={{ powerPreference: "low-power" }}
              enablePointerInteraction={false}
              htmlElementsData={[SG]}
              htmlLat="lat"
              htmlLng="lon"
              htmlElement={marker}
              pointsData={fires}
              pointLat={fireLat}
              pointLng={fireLng}
              pointColor={fireColor}
              pointAltitude={0.003}
              pointRadius={0.45}
              pointResolution={5}
              pointsMerge
              pointsTransitionDuration={0}
              pathsData={paths}
              pathPoints={trailPoints}
              pathPointLat={trailLat}
              pathPointLng={trailLng}
              pathPointAlt={0.008}
              pathColor={trailColor}
              pathStroke={0.9}
              pathTransitionDuration={0}
              onGlobeReady={onReady}
            />
          </div>
        )}

        <span className="tabular absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white" aria-live="polite">
          {ranges[layer]}
        </span>
      </div>

      <div className="mt-3 text-[13px] text-muted">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          {ramp.ends[0]}
          <span aria-hidden className="h-2 flex-1 rounded-full" style={{ background: rampCss(ramp) }} />
          {ramp.ends[1]}
        </div>
        <p className="tabular mb-1 mt-0.5 text-center text-[11px] opacity-80">
          {ramp.unit}: {ramp.range[0]} to {ramp.range[1]}+
        </p>
        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {fires.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: FIRE_COLOR }} />
              Fires
            </span>
          )}
          {trail && (
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ background: TRAIL_COLOR }} />
              Air&apos;s path, last 3 days
            </span>
          )}
        </div>
        <p aria-live="polite">{note}</p>
      </div>
      <p className="mt-1 text-[12px] text-muted">{GLOBE_CREDIT}</p>
    </div>
  );
}
