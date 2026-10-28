import { PM25_COLORS, REGIONS, REGION_POINT, psiLevel, type Region } from "@/lib/bands";
import { cap } from "@/lib/format";
import { PM25, bandOf, colorOf, concentrationOfSub, pollutant, type Pollutant, type PollutantId } from "@/lib/pollutants";
import type { HazeData, NeaNow, Station } from "@/lib/types";
import { MAX_SENSOR_AGE_MS } from "@/lib/util";

/** A real (or, for Indonesian cities, modelled) reading drawn as a dot on the globe. */
export type Dot = {
  lat: number;
  lon: number;
  /** Place and source, e.g. "Central, NEA". */
  label: string;
  /** The reading with its unit, e.g. "38 µg/m³ PM2.5". */
  value: string;
  band: 0 | 1 | 2 | 3 | null;
  /** Measured readings are filled dots; model values are hollow rings. */
  kind: "measured" | "model";
  /** What shows first when zoomed out: 0 NEA's regions, 1 Malaysian stations and Indonesian cities, 2 community sensors. */
  rank: 0 | 1 | 2;
  /** Dot colour where the layer has its own scale (CO's tracer ramp); else the band's. */
  color?: string;
};

/** What the dots need of the page's data: small enough to send to the browser (the stations without their extras, only the newest NEA hour). */
export type DotData = {
  nea: Pick<NeaNow, "sub" | "no2_1h_max"> | null;
  history: { regions: Record<Region, { value: number }[]> } | null;
  stations: Pick<Station, "name" | "country" | "lat" | "lon" | "pm25" | "api">[];
  sensors: HazeData["sensors"];
};

/** `data` cut down to `DotData`. */
export function dotData({ nea, history, stations, sensors }: Pick<HazeData, "nea" | "history" | "stations" | "sensors">): DotData {
  return {
    nea: nea && { sub: nea.sub, no2_1h_max: nea.no2_1h_max },
    history: history && { regions: Object.fromEntries(REGIONS.map((r) => [r, history.regions[r].slice(-1)])) as unknown as Record<Region, { value: number }[]> },
    stations: stations.map(({ name, country, lat, lon, pm25, api }) => ({ name, country, lat, lon, pm25, api })),
    sensors,
  };
}

/** NEA PSI bands (sub-index 50, 100, 200) as the four bands; PSI above 200 is band 3 (NEA, haze.gov.sg PSI table). */
const psiBand = (psi: number) => Math.min(psiLevel(psi), 3) as 0 | 1 | 2 | 3;

const pm25Dot = (p: Pick<Dot, "lat" | "lon" | "label" | "kind" | "rank">, v: number): Dot => ({ ...p, value: `${Math.round(v)} ${PM25.unit} ${PM25.label}`, band: bandOf(PM25, v) });

/** NEA region dots: the chosen pollutant (1-hour PM2.5, a PSI sub-index, or the NO2 1-hour maximum). */
function neaDots(data: DotData, p: Pollutant): Dot[] {
  const { nea, history } = data;
  const out: Dot[] = [];
  for (const r of REGIONS) {
    const at = { lat: REGION_POINT[r][0], lon: REGION_POINT[r][1], label: `${cap(r)}, NEA`, kind: "measured" as const, rank: 0 as const };
    if (p.id === "pm25") {
      const v = history?.regions[r].at(-1)?.value;
      if (v != null && Number.isFinite(v)) out.push(pm25Dot(at, v));
    } else if (p.id === "no2") {
      const v = nea?.no2_1h_max[r];
      if (v != null && Number.isFinite(v)) out.push({ ...at, value: `${Math.round(v)} ${p.unit} ${p.label}`, band: bandOf(p, v) });
    } else {
      const v = nea?.sub[p.id as keyof NonNullable<DotData["nea"]>["sub"]]?.[r];
      if (v != null && Number.isFinite(v)) {
        const dot: Dot = { ...at, value: `PSI sub-index ${Math.round(v)} (${p.label})`, band: psiBand(v) };
        if (p.tracer) dot.color = rgbOf(colorOf(p, concentrationOfSub(p, v))); // the dot sits on the same ramp as the field
        out.push(dot);
      }
    }
  }
  return out;
}

/**
 * The dots for the shown day: NEA regions for the chosen pollutant; Malaysian stations and community sensors with their PM2.5
 * (or the station's API when it has no PM2.5); Indonesian cities as model values. Only for today; dust, smoke and off show none.
 * `now` is for tests.
 */
export function readingDots(data: DotData, layer: PollutantId | "smoke" | "off", isToday: boolean, now = Date.now()): Dot[] {
  if (!isToday || layer === "off" || layer === "smoke" || layer === "dust") return [];
  const out = neaDots(data, pollutant(layer));
  for (const s of data.stations) {
    if (s.country === "SG") continue; // NEA's regions cover Singapore
    const at = { lat: s.lat, lon: s.lon, label: `${s.name}, ${s.country === "ID" ? "Model" : "Malaysia"}`, kind: s.country === "ID" ? ("model" as const) : ("measured" as const), rank: 1 as const };
    if (s.pm25 != null) out.push(pm25Dot(at, s.pm25));
    else if (s.api != null && s.country === "MY") out.push({ ...at, value: `API ${s.api}`, band: psiBand(s.api) }); // Malaysia's API has the PSI's band edges
  }
  for (const s of data.sensors) {
    if (!(now - new Date(s.time).getTime() < MAX_SENSOR_AGE_MS)) continue; // too old, or a time that is not a date (NaN)
    out.push(pm25Dot({ lat: s.lat, lon: s.lon, label: `${s.name}, Sensor`, kind: "measured", rank: 2 }, s.pm25));
  }
  return out;
}

const rgbOf = ([r, g, b]: number[], k = 1) => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;

const GREY = "rgb(150,150,150)";

/** The air-level colour of a band, at full opacity: the colour the field is drawn in (see `STOPS` in pollutants.ts), so a dot matches the shading around it. */
export function bandColor(band: Dot["band"]): string {
  return band == null ? GREY : PM25_COLORS[band];
}

/** The dots as GeoJSON points for the map's source. */
export function dotFeatures(dots: Dot[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: dots.map((d) => ({
      type: "Feature",
      properties: { label: d.label, value: d.value, kind: d.kind, rank: d.rank, color: d.color ?? bandColor(d.band) },
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
    })),
  };
}
