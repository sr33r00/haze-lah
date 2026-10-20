import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

// The map under the satellite data: OpenFreeMap's dark style (free, no key; OpenStreetMap data, © OpenMapTiles),
// cut down to what reads well over colours. Water edges, borders, a few major roads and place names only, all drawn
// on top of the data; no icons, so the style's sprite is never fetched; names in English only, so one font range.

export const BASEMAP = "https://tiles.openfreemap.org/styles/dark";

const LAND = "#161b22";
const WATER = "#0a1018";
const FONT = ["Noto Sans Regular"];
const NAME = ["coalesce", ["get", "name_en"], ["get", "name"]];

/** Border lines: thin and pale, so they show on every colour of the data. */
const border = (alpha: number, width: number) => ({
  "line-color": `rgba(255,255,255,${alpha})`,
  "line-width": ["interpolate", ["linear"], ["zoom"], 1, width * 0.6, 6, width, 10, width * 1.8],
});

/** Place names in `color`, with a dark halo so they stay legible over the data. */
const label = (size: number, color: string, upper = false) => ({
  layout: { "text-field": NAME, "text-font": FONT, "text-size": size, "text-anchor": "center", ...(upper && { "text-transform": "uppercase", "text-letter-spacing": 0.08 }) },
  paint: { "text-color": color, "text-halo-color": "rgba(5,7,13,0.9)", "text-halo-width": 1.6 },
});

const road = { "line-color": "rgba(255,255,255,0.3)", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 9, 1.2] };

/** The layers kept, by id of the stock style, with what replaces their look and when they show. Order is the style's. */
const KEEP: Record<string, { paint: object; layout?: object; minzoom?: number; maxzoom?: number }> = {
  background: { paint: { "background-color": LAND } },
  water: { paint: { "fill-color": WATER, "fill-antialias": false } },
  landcover_glacier: { paint: { "fill-color": "#1e2630", "fill-opacity": 0.7 } },
  landuse_park: { paint: { "fill-color": "#1a222b" } },
  boundary_state: { paint: { ...border(0.32, 0.8), "line-dasharray": [3, 3] }, minzoom: 4 },
  "boundary_country_z0-4": { paint: border(0.6, 1) },
  "boundary_country_z5-": { paint: border(0.6, 1) },
  highway_major_subtle: { paint: road },
  highway_motorway_inner: { paint: road, minzoom: 6 },
  place_city_large: { ...label(13, "#f1f5f9"), minzoom: 4 },
  place_city: { ...label(12, "#f1f5f9"), minzoom: 5 },
  place_town: { ...label(11, "#cbd5e1"), minzoom: 6 },
  place_country_other: { ...label(11, "rgba(255,255,255,0.75)", true) },
  place_country_minor: { ...label(11, "rgba(255,255,255,0.75)", true) },
  place_country_major: { ...label(12, "rgba(255,255,255,0.85)", true) },
};

/** The stock style cut down to the layers above, plus the water's edge as a line: the coastlines. Singapore's name is left off: the map has its own pin there. */
export function trimStyle(style: StyleSpecification): StyleSpecification {
  const kept = style.layers.flatMap((l) => {
    const k = KEEP[l.id];
    if (!k) return [];
    const filter = l.type === "symbol" && l.filter ? { filter: ["all", l.filter, ["!=", ["get", "name"], "Singapore"]] } : {};
    return [{ ...l, ...k, ...filter } as LayerSpecification];
  });
  const water = kept.find((l) => l.id === "water")!;
  const coast = { ...water, id: "water_edge", type: "line", paint: border(0.55, 0.8) } as LayerSpecification;
  kept.splice(kept.findIndex((l) => l.type === "line"), 0, coast);
  const out: StyleSpecification = { ...style, sources: { openmaptiles: style.sources.openmaptiles }, layers: kept };
  delete out.sprite; // nothing drawn needs an icon
  return out;
}
