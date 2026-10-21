import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

// The map under the satellite data: OpenFreeMap's dark style (free, no key; OpenStreetMap data, © OpenMapTiles),
// cut down to what reads well over colours. Water edges, borders, a few major roads and place names only, all drawn
// on top of the data; no icons, so the style's sprite is never fetched; names in English only, so one font range.
//
// OpenFreeMap's world tiles are heavy (600 KB at zoom 2, 90 to 130 KB each at zoom 5 and 6), so below zoom SWITCH its tiles
// are never asked for. A light outline stands in: public/world.json, Natural Earth (public domain) 50m land, borders, country
// names and big cities. It was made once from ne_50m_land, ne_50m_admin_0_boundary_lines_land, ne_50m_admin_0_countries and
// ne_10m_populated_places_simple (github.com/nvkelso/natural-earth-vector, /geojson): Douglas-Peucker to 0.04 degrees around
// Southeast Asia and 0.3 elsewhere, coordinates to 2 decimals, islands under 0.3 square degrees dropped outside it, Singapore
// left out, and only the properties used here kept: k kind, n name, z label rank (from Natural Earth), p population in 100 000s. Land that runs along
// the antimeridian or the pole is kind "cut": filled here, its coast kept apart as "coast" lines with those edges removed.
// Over FADE zoom levels from SWITCH the outline fades out as the vector tiles' own lines fade in.

export const BASEMAP = "https://tiles.openfreemap.org/styles/dark";
const OUTLINE = "/world.json";
const SWITCH = 6;
const FADE = 0.5; // zoom levels over which the outline gives way to the tiles

const LAND = "#161b22";
const WATER = "#0a1018";
const FONT = ["Noto Sans Regular"];
const NAME = ["coalesce", ["get", "name_en"], ["get", "name"]];

/** Full below SWITCH and gone FADE above it (the outline), or the reverse (the vector tiles' lines). */
const fade = (outline: boolean): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], SWITCH, +outline, SWITCH + FADE, +!outline];

/** Border lines: thin and pale, so they show on every colour of the data. */
const border = (alpha: number, width: number, outline = false) => ({
  "line-color": `rgba(255,255,255,${alpha})`,
  "line-width": ["interpolate", ["linear"], ["zoom"], 1, width * 0.6, 6, width, 10, width * 1.8],
  "line-opacity": fade(outline),
});

/** Place names in `color`, with a dark halo so they stay legible over the data. */
const label = (size: number, color: string, upper = false, field: unknown = NAME) => ({
  layout: { "text-field": field, "text-font": FONT, "text-size": size, "text-anchor": "center", ...(upper && { "text-transform": "uppercase", "text-letter-spacing": 0.08 }) },
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

const kind = (...kinds: string[]): ExpressionSpecification => ["in", ["get", "k"], ["literal", kinds]];

/** A layer of the outline's source that shows only below SWITCH (and, for what is drawn as a shape, fades out above it). */
const light = (id: string, type: string, rest: object, fades = true) => ({ id, type, source: "world", ...(fades && { maxzoom: SWITCH + FADE }), ...rest }) as LayerSpecification;

/** City names of the outline, in order of size; `big` ones from the start, the rest closer in. */
const city = (big: boolean) => {
  const { layout, paint } = label(big ? 12 : 11, big ? "#f1f5f9" : "#cbd5e1", false, ["get", "n"]);
  return light(`o_city_${+big}`, "symbol", {
    minzoom: big ? 2 : 4,
    maxzoom: SWITCH,
    filter: ["all", kind("city"), [big ? ">=" : "<", ["get", "p"], 50]],
    layout: { ...layout, "symbol-sort-key": ["-", ["get", "p"]] },
    paint,
  }, false);
};

let style: Promise<StyleSpecification> | undefined;

/**
 * OpenFreeMap's stock style, fetched once and shared: the card starts it with the map's code, long before the map is made. Once it is here,
 * the tile list and the one font range the names use are fetched too, so that the browser has them by the time the map asks. Rejects when unavailable; a later call asks again.
 */
export function fetchBasemap(): Promise<StyleSpecification> {
  style ??= fetch(BASEMAP)
    .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : Promise.reject()))
    .then((json) => {
      const tiles = json.sources.openmaptiles;
      const urls = [json.glyphs?.replace("{fontstack}", encodeURIComponent(FONT[0])).replace("{range}", "0-255"), "url" in tiles ? tiles.url : undefined];
      for (const url of urls) if (url) fetch(url).catch(() => {});
      return json;
    })
    .catch((e) => {
      style = undefined;
      throw e;
    });
  return style;
}

/** The stock style cut down to the layers above, plus the water's edge as a line: the coastlines. Singapore's name is left off: the map has its own pin there. Below SWITCH the outline stands in for the tiles. */
export function trimStyle(style: StyleSpecification): StyleSpecification {
  const kept = style.layers.flatMap((l) => {
    const k = KEEP[l.id];
    if (!k) return [];
    const filter = l.type === "symbol" && l.filter ? { filter: ["all", l.filter, ["!=", ["get", "name"], "Singapore"]] } : {};
    return [{ ...l, ...k, ...filter } as LayerSpecification];
  });
  const water = kept.find((l) => l.id === "water")!;
  const coast = { ...water, id: "water_edge", type: "line", paint: border(0.55, 0.8) } as LayerSpecification;
  const country = label(11, "rgba(255,255,255,0.75)", true, ["get", "n"]);
  kept.splice(kept.findIndex((l) => l.type === "line"), 0,
    light("o_coast", "line", { filter: kind("land", "coast"), paint: border(0.55, 0.8, true) }),
    light("o_border", "line", { filter: kind("border"), paint: border(0.6, 1, true) }),
    coast,
  );
  kept.splice(1, 0,
    light("o_sea", "background", { paint: { "background-color": WATER, "background-opacity": fade(true) } }),
    light("o_land", "fill", { filter: kind("land", "cut"), paint: { "fill-color": LAND, "fill-antialias": false, "fill-opacity": fade(true) } }),
  );
  kept.push(
    light("o_country", "symbol", { maxzoom: SWITCH, filter: kind("country"), layout: { ...country.layout, "symbol-sort-key": ["get", "z"] }, paint: country.paint }, false),
    city(true),
    city(false),
  );
  const out: StyleSpecification = {
    ...style,
    sources: { openmaptiles: { ...style.sources.openmaptiles, minzoom: SWITCH } as StyleSpecification["sources"][string], world: { type: "geojson", data: OUTLINE } },
    layers: kept,
  };
  delete out.sprite; // nothing drawn needs an icon
  return out;
}
