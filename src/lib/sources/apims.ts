import type { Station } from "../types";
import { SG, getJson, haversineKm, num } from "../util";

// Malaysia Department of Environment, Air Pollutant Index Management System (APIMS).
// Public ArcGIS layer behind https://eqms.doe.gov.my/APIMS/main.
const URL =
  "https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID,DATETIME,API,PM25_CONC,PM10_CONC,O3_CONC,CO_CONC,SO2_CONC,NO2_CONC,LONGITUDE,LATITUDE,STATION_LOCATION,STATE_NAME,STATION_STATUS&returnGeometry=false&f=json";

const MYT_OFFSET_MS = 8 * 3600_000;

// ArcGIS reports query errors (e.g. an unknown field) as HTTP 200 with an error body.
type Resp = { features?: { attributes: Record<string, unknown> }[]; error?: { message?: string } };

function title(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One station's readings as APIMS publishes them for its latest hour, unrounded; null where the station has none. */
export type ApimsReading = Record<"api" | "pm25" | "pm10" | "o3" | "co" | "so2" | "no2", number | null>;

export type ApimsRow = { station: Station; reading: ApimsReading };

/** A reading APIMS leaves empty or marks with a negative number is missing. */
const reading = (v: unknown) => {
  const n = num(v);
  return n != null && n >= 0 ? n : null;
};

/** Every station within `maxKm` of Singapore, nearest first, with its latest hour of readings. APIMS serves only that hour, never history. */
export async function fetchApimsRows(maxKm = 700): Promise<ApimsRow[]> {
  const j = await getJson<Resp>(URL);
  if (j.error) throw new Error(`APIMS: ${j.error.message ?? "query failed"}`);
  const out: ApimsRow[] = [];
  for (const f of j.features ?? []) {
    const a = f.attributes;
    const lat = num(a.LATITUDE);
    const lon = num(a.LONGITUDE);
    if (lat == null || lon == null) continue;
    const distanceKm = haversineKm(SG.lat, SG.lon, lat, lon);
    if (distanceKm > maxKm) continue;
    const r: ApimsReading = {
      api: reading(a.API),
      pm25: reading(a.PM25_CONC),
      pm10: reading(a.PM10_CONC),
      o3: reading(a.O3_CONC),
      co: reading(a.CO_CONC),
      so2: reading(a.SO2_CONC),
      no2: reading(a.NO2_CONC),
    };
    const dt = a.DATETIME;
    out.push({
      station: {
        id: String(a.STATION_ID ?? ""),
        name: title(String(a.STATION_LOCATION ?? a.STATION_ID ?? "").split(",")[0]),
        state: title(String(a.STATE_NAME ?? "")),
        country: "MY",
        lat,
        lon,
        api: r.api != null ? Math.round(r.api) : null,
        pm25: r.pm25 != null ? Math.round(r.pm25) : null,
        // DATETIME is Malaysia local time (UTC+8) stored as if it were UTC.
        time: typeof dt === "number" ? new Date(dt - MYT_OFFSET_MS).toISOString() : dt ? String(dt) : null,
        distanceKm: Math.round(distanceKm),
      },
      reading: r,
    });
  }
  return out.sort((a, b) => a.station.distanceKm - b.station.distanceKm);
}

export async function fetchApims(maxKm = 700): Promise<Station[]> {
  return (await fetchApimsRows(maxKm)).map((r) => r.station);
}
