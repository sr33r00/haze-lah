import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { fetchBasemap, trimStyle } from "@/lib/basemap";
import { GIBS_WMTS } from "@/lib/globe";
import { NEW_FIRE_COLOR, TRAIL_COLOR } from "@/lib/replay";

/** Colours of the globe, in one place. */
export const INK = {
  space: "#02030a",
  sky: "#0a1a38", // the atmosphere's body
  horizon: "#3d78c9", // the glow at the limb
  fireCore: "#ffd23f",
  fireGlow: "#ff3b1f",
  newZone: NEW_FIRE_COLOR,
  trail: TRAIL_COLOR,
  ahead: "#fbbf77",
};

/** The base pictures' URL scheme: `gibs://` followed by the https address of a GIBS tile, loaded by `gibsTiles.ts` (kept apart, so that this file, which the card reads for its colours, does not pull in MapLibre). */
export const GIBS_SCHEME = "gibs";
/** The finest level of NASA's base pictures. */
export const BASE_MAX_ZOOM = 8;
/** NASA's two base pictures as tile addresses: Blue Marble relief and the Black Marble night lights of 2016. */
export const BASE_TILES = {
  day: `${GIBS_WMTS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
  night: `${GIBS_WMTS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
};

const KEEP = new Set(["boundary_country_z5-", "boundary_state", "o_coast", "o_border", "water_edge"]);

/** The OpenFreeMap style cut to its coast and border lines (names are drawn by the globe itself, a few at a time), on top of NASA's night and day pictures: a quiet, dark globe. */
export async function globeStyle(): Promise<StyleSpecification> {
  const stock = trimStyle(await fetchBasemap());
  const lines = stock.layers.filter((l) => KEEP.has(l.id)).map((l): LayerSpecification => {
    if (l.type === "line") {
      // Country borders bright and clear; coasts a step quieter; province lines faint.
      const [alpha, w] = l.id.startsWith("boundary_state") ? [0.14, 0.5] : l.id.includes("coast") || l.id === "water_edge" ? [0.45, 0.8] : [0.85, 1.3];
      const paint = Object.fromEntries(Object.entries(l.paint ?? {}).filter(([k]) => k !== "line-dasharray")); // solid lines, never dashed
      return {
        ...l,
        paint: { ...paint, "line-color": `rgba(235,242,255,${alpha})`, "line-width": ["interpolate", ["linear"], ["zoom"], 1, w, 6, w * 1.5, 10, w * 2.2] as ExpressionSpecification },
      } as LayerSpecification;
    }
    return l;
  });
  const raster = (id: keyof typeof BASE_TILES, paint: object): [object, LayerSpecification] => [
    { type: "raster", tiles: [`${GIBS_SCHEME}://${BASE_TILES[id]}`], tileSize: 256, maxzoom: BASE_MAX_ZOOM, attribution: "NASA GIBS" },
    { id, type: "raster", source: id, paint: { "raster-fade-duration": 0, ...paint } } as LayerSpecification,
  ];
  const [dayS, dayL] = raster("day", { "raster-brightness-max": 0.4, "raster-saturation": -0.45, "raster-contrast": 0.1 });
  const [nightS, nightL] = raster("night", { "raster-opacity": 0.88, "raster-brightness-max": 1, "raster-saturation": -0.2 });
  return {
    ...stock,
    projection: { type: "globe" },
    sky: {
      "sky-color": INK.sky,
      "horizon-color": INK.horizon,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.9, 8, 0] as ExpressionSpecification,
    },
    glyphs: stock.glyphs,
    sources: { day: dayS, night: nightS, openmaptiles: stock.sources.openmaptiles, world: stock.sources.world } as StyleSpecification["sources"],
    layers: [{ id: "space", type: "background", paint: { "background-color": INK.space } }, dayL, nightL, ...lines],
  };
}
