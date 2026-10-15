import type { Station } from "../types";
import { SG, getJson, haversineKm, num } from "../util";

// Malaysia Department of Environment, Air Pollutant Index Management System (APIMS).
// Public ArcGIS layer behind https://eqms.doe.gov.my/APIMS/main.
const URL =
  "https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID,DATETIME,API,PM25_CONC,PM25_1H_AVG,LONGITUDE,LATITUDE,STATION_LOCATION,STATE_NAME,STATION_STATUS&returnGeometry=false&f=json";

type Resp = { features?: { attributes: Record<string, unknown> }[] };

function title(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchApims(maxKm = 700): Promise<Station[]> {
  const j = await getJson<Resp>(URL, { revalidate: 600 });
  const out: Station[] = [];
  for (const f of j.features ?? []) {
    const a = f.attributes;
    const lat = num(a.LATITUDE);
    const lon = num(a.LONGITUDE);
    if (lat == null || lon == null) continue;
    const distanceKm = haversineKm(SG.lat, SG.lon, lat, lon);
    if (distanceKm > maxKm) continue;
    const api = num(a.API);
    const pm = num(a.PM25_CONC) ?? num(a.PM25_1H_AVG);
    const dt = a.DATETIME;
    out.push({
      id: String(a.STATION_ID ?? ""),
      name: title(String(a.STATION_LOCATION ?? a.STATION_ID ?? "").split(",")[0]),
      state: title(String(a.STATE_NAME ?? "")),
      country: "MY",
      lat,
      lon,
      api: api != null && api >= 0 ? Math.round(api) : null,
      pm25: pm != null && pm >= 0 ? Math.round(pm) : null,
      time: typeof dt === "number" ? new Date(dt).toISOString() : dt ? String(dt) : null,
      distanceKm: Math.round(distanceKm),
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}
