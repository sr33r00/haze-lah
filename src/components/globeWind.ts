import type { Map as MapLibre } from "maplibre-gl";
import type { WindView } from "@/lib/windParticles";

const RAD = Math.PI / 180;
const WORLD = 512; // MapLibre's world is this many pixels round at zoom 0
const LIMB = 3; // degrees short of the horizon where drawing stops: the globe's edge is too slanted to read

/** MapLibre's globe as the wind animation sees it. The canvas sits over the map and under its controls and markers. */
export function globeView(map: MapLibre): WindView {
  let sin = 0; // the middle of the view
  let cos = 1;
  let lon = 0;
  let reach = 0; // cosine of the angle from the middle to where drawing stops
  const look = () => {
    const c = map.getCenter();
    const height = map.getContainer().clientHeight;
    const radius = (WORLD * 2 ** map.getZoom()) / (2 * Math.PI);
    const eye = height / 2 / Math.tan((map.getVerticalFieldOfView() * RAD) / 2); // how far the camera is from the middle, in pixels
    sin = Math.sin(c.lat * RAD);
    cos = Math.cos(c.lat * RAD);
    lon = c.lng;
    reach = Math.cos(Math.max(0, Math.acos(radius / (radius + eye)) - LIMB * RAD));
  };
  look();
  return {
    container: map.getCanvasContainer(),
    zIndex: 1,
    size: () => {
      const { clientWidth, clientHeight } = map.getContainer();
      return { w: clientWidth, h: clientHeight };
    },
    project: (lat, lng) => {
      // Past the horizon the globe hides a place, and MapLibre would still give it a point on the near side.
      if (sin * Math.sin(lat * RAD) + cos * Math.cos(lat * RAD) * Math.cos((lng - lon) * RAD) < reach) return null;
      return map.project([lng, lat]);
    },
    bounds: () => {
      const b = map.getBounds();
      return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    },
    pxPerDeg: () => (WORLD * 2 ** map.getZoom()) / 360,
    listen: ({ moved, settled, resized }) => {
      const move = () => {
        look();
        moved();
      };
      const size = () => {
        look();
        resized();
      };
      map.on("move", move);
      map.on("moveend", settled);
      map.on("resize", size);
      return () => {
        map.off("move", move);
        map.off("moveend", settled);
        map.off("resize", size);
      };
    },
  };
}
