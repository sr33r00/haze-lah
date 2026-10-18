import { nearestRegion } from "../bands";
import type { Camera } from "../types";
import { getJson } from "../util";

// LTA traffic camera photos via data.gov.sg (Singapore Open Data Licence), refreshed every few minutes.
const URL = "https://api.data.gov.sg/v1/transport/traffic-images";

type Resp = { items: { cameras: { camera_id: string; timestamp: string; image: string; location: { latitude: number; longitude: number } }[] }[] };

// data.gov.sg gives only ids and coordinates; LTA's names for the cameras in the open feed.
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

export async function fetchCameras(): Promise<Camera[]> {
  const j = await getJson<Resp>(URL, { revalidate: 120 });
  return (j.items[0]?.cameras ?? []).map((c) => ({
    id: c.camera_id,
    name: NAMES[c.camera_id] ?? `Traffic camera ${c.camera_id}`,
    region: nearestRegion(c.location.latitude, c.location.longitude),
    lat: c.location.latitude,
    lon: c.location.longitude,
    image: c.image,
    time: c.timestamp,
  }));
}
