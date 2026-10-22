import { nearestRegion } from "../bands";
import type { Camera } from "../types";
import { getJson } from "../util";

// LTA traffic camera photos (Singapore Open Data Licence). With LTA_DATAMALL_KEY set they come from DataMall (about
// 90 cameras); otherwise from data.gov.sg's open feed (8 cameras). Either way the browser only ever sees our own
// /api/camera/{id}: the key stays on the server, DataMall is never linked to directly, and its image links expire.

/** A camera as the upstream feed describes it, with the upstream image URL (server side only). */
type Shot = { id: string; lat: number; lon: number; url: string; time: string };

type GovResp = { items: { timestamp: string; cameras: { camera_id: string; timestamp: string; image: string; location: { latitude: number; longitude: number } }[] }[] };
type MallResp = { value: { CameraID: string; Latitude: number; Longitude: number; ImageLink: string }[] };

// DataMall image links expire after about 5 minutes, so the list is refreshed every minute. It is kept in memory, not
// in the data cache, so the refreshes cost no cache writes.
const LIST_TTL = 60_000;
// Photos are shown in 5-minute steps: each step has its own URL, so the CDN serves one copy per camera per step.
const PHOTO_STEP = 5 * 60_000;

// The feeds give only ids and coordinates; LTA's names for the cameras we know.
const NAMES: Record<string, string> = {
  "2701": "Woodlands Causeway, towards Johor",
  "2702": "Woodlands Checkpoint",
  "2704": "Woodlands Flyover, towards Checkpoint",
  "4703": "Tuas Second Link",
  "4712": "AYE, Tuas Avenue 8 exit",
  "4713": "Tuas Checkpoint",
  "4798": "Sentosa Gateway, towards Telok Blangah",
  "4799": "Sentosa Gateway, towards Sentosa",
};

async function fromDataMall(key: string): Promise<Shot[]> {
  const j = await getJson<MallResp>("https://datamall2.mytransport.sg/ltaodataservice/Traffic-Imagesv2", {
    headers: { AccountKey: key, accept: "application/json" },
    revalidate: 0,
  });
  const time = new Date().toISOString(); // DataMall gives no capture time; its photos are at most a few minutes old
  return j.value.map((c) => ({ id: String(c.CameraID), lat: Number(c.Latitude), lon: Number(c.Longitude), url: c.ImageLink, time }));
}

async function fromDataGov(): Promise<Shot[]> {
  const j = await getJson<GovResp>("https://api.data.gov.sg/v1/transport/traffic-images", { revalidate: 0 });
  return (j.items[0]?.cameras ?? []).map((c) => ({ id: c.camera_id, lat: c.location.latitude, lon: c.location.longitude, url: c.image, time: c.timestamp }));
}

let list: { at: number; shots: Promise<Shot[]> } | undefined;

/** The camera list, shared by all requests on this server for a minute; a failed fetch is not kept. */
function fetchShots(): Promise<Shot[]> {
  if (list && Date.now() - list.at < LIST_TTL) return list.shots;
  const key = process.env.LTA_DATAMALL_KEY;
  const shots = key ? fromDataMall(key) : fromDataGov();
  list = { at: Date.now(), shots };
  shots.catch(() => {
    if (list?.shots === shots) list = undefined;
  });
  return shots;
}

/** Cameras for the page. `image` points at our proxy; its `v` names the 5-minute step, so the CDN can keep each photo for the step. */
export async function fetchCameras(): Promise<Camera[]> {
  return (await fetchShots()).map((c) => ({
    id: c.id,
    name: NAMES[c.id] ?? `Traffic camera ${c.id}`,
    region: nearestRegion(c.lat, c.lon),
    lat: c.lat,
    lon: c.lon,
    image: `/api/camera/${encodeURIComponent(c.id)}?v=${(Date.parse(c.time) / PHOTO_STEP) | 0}`,
    time: c.time,
  }));
}

/** The latest photo of one camera, fetched from upstream; null if there is no such camera. Nothing is stored. */
export async function fetchCameraPhoto(id: string): Promise<Response | null> {
  const shot = (await fetchShots()).find((c) => c.id === id);
  if (!shot) return null;
  const res = await fetch(shot.url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`camera ${id}: ${res.status}`);
  return res;
}
